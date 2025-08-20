#!/bin/bash

# backup-production.sh - 本番環境バックアップスクリプト
# 使用法: ./scripts/backup-production.sh [database|configs|all]

set -euo pipefail

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 設定
NAMESPACE="production"
BACKUP_DIR="/tmp/k8s-backup/$(date +%Y%m%d_%H%M%S)"
S3_BUCKET="${K8S_BACKUP_S3_BUCKET:-}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo
    echo -e "${PURPLE}============================================${NC}"
    echo -e "${PURPLE} $1${NC}"
    echo -e "${PURPLE}============================================${NC}"
    echo
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl が見つかりません"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Kubernetesクラスターに接続できません"
        exit 1
    fi
    
    # バックアップディレクトリ作成
    mkdir -p "${BACKUP_DIR}"
    log_success "バックアップディレクトリ作成: ${BACKUP_DIR}"
    
    log_success "前提条件OK"
}

# Kubernetes設定バックアップ
backup_kubernetes_configs() {
    log_header "Kubernetes設定バックアップ"
    
    local config_dir="${BACKUP_DIR}/kubernetes"
    mkdir -p "${config_dir}"
    
    log_info "名前空間設定をバックアップ中..."
    kubectl get namespace ${NAMESPACE} -o yaml > "${config_dir}/namespace.yaml"
    
    log_info "ConfigMapをバックアップ中..."
    kubectl get configmaps -n ${NAMESPACE} -o yaml > "${config_dir}/configmaps.yaml"
    
    log_info "Secretをバックアップ中..."
    kubectl get secrets -n ${NAMESPACE} -o yaml > "${config_dir}/secrets.yaml"
    
    log_info "Deploymentをバックアップ中..."
    kubectl get deployments -n ${NAMESPACE} -o yaml > "${config_dir}/deployments.yaml"
    
    log_info "Serviceをバックアップ中..."
    kubectl get services -n ${NAMESPACE} -o yaml > "${config_dir}/services.yaml"
    
    log_info "HPAをバックアップ中..."
    kubectl get hpa -n ${NAMESPACE} -o yaml > "${config_dir}/hpa.yaml" 2>/dev/null || true
    
    log_info "NetworkPolicyをバックアップ中..."
    kubectl get networkpolicy -n ${NAMESPACE} -o yaml > "${config_dir}/networkpolicy.yaml" 2>/dev/null || true
    
    log_info "ResourceQuotaをバックアップ中..."
    kubectl get resourcequota -n ${NAMESPACE} -o yaml > "${config_dir}/resourcequota.yaml" 2>/dev/null || true
    
    log_info "PVCをバックアップ中..."
    kubectl get pvc -n ${NAMESPACE} -o yaml > "${config_dir}/pvc.yaml" 2>/dev/null || true
    
    log_success "Kubernetes設定バックアップ完了"
}

# データベースバックアップ
backup_databases() {
    log_header "データベースバックアップ"
    
    local db_dir="${BACKUP_DIR}/databases"
    mkdir -p "${db_dir}"
    
    # PostgreSQL バックアップ（各サービスのDB）
    local services=("order" "payment" "inventory" "shipping")
    
    for service in "${services[@]}"; do
        log_info "${service} データベースをバックアップ中..."
        
        # データベースPodを探す
        local db_pod=$(kubectl get pods -n ${NAMESPACE} -l app=${service}-db -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
        
        if [[ -n "$db_pod" ]]; then
            # PostgreSQLダンプ実行
            kubectl exec -n ${NAMESPACE} ${db_pod} -- pg_dump -U postgres ${service}_db > "${db_dir}/${service}_db_$(date +%Y%m%d_%H%M%S).sql" 2>/dev/null || \
                log_warning "${service} データベースのバックアップに失敗しました"
            
            log_success "${service} データベースバックアップ完了"
        else
            log_warning "${service} データベースPodが見つかりません"
        fi
    done
}

# Kafkaトピックデータバックアップ
backup_kafka() {
    log_header "Kafkaデータバックアップ"
    
    local kafka_dir="${BACKUP_DIR}/kafka"
    mkdir -p "${kafka_dir}"
    
    # KafkaPodを探す
    local kafka_pod=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=kafka -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    
    if [[ -n "$kafka_pod" ]]; then
        log_info "Kafkaトピック一覧をバックアップ中..."
        kubectl exec -n ${NAMESPACE} ${kafka_pod} -- kafka-topics.sh --bootstrap-server localhost:9092 --list > "${kafka_dir}/topics.list" 2>/dev/null || \
            log_warning "Kafkaトピック一覧の取得に失敗しました"
        
        log_info "Kafkaトピック設定をバックアップ中..."
        if [[ -f "${kafka_dir}/topics.list" ]]; then
            while IFS= read -r topic; do
                [[ -n "$topic" ]] && kubectl exec -n ${NAMESPACE} ${kafka_pod} -- kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic "$topic" > "${kafka_dir}/topic_${topic}_config.txt" 2>/dev/null || true
            done < "${kafka_dir}/topics.list"
        fi
        
        log_success "Kafkaデータバックアップ完了"
    else
        log_warning "Kafka Podが見つかりません"
    fi
}

# アプリケーションログバックアップ
backup_logs() {
    log_header "アプリケーションログバックアップ"
    
    local logs_dir="${BACKUP_DIR}/logs"
    mkdir -p "${logs_dir}"
    
    local services=("order-service" "payment-service" "inventory-service" "shipping-service" "notification-service" "status-service")
    
    for service in "${services[@]}"; do
        log_info "${service} のログをバックアップ中..."
        
        local pod=$(kubectl get pods -n ${NAMESPACE} -l app=${service} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
        
        if [[ -n "$pod" ]]; then
            kubectl logs ${pod} -n ${NAMESPACE} --since=24h > "${logs_dir}/${service}_$(date +%Y%m%d_%H%M%S).log" 2>/dev/null || \
                log_warning "${service} のログ取得に失敗しました"
            
            log_success "${service} ログバックアップ完了"
        else
            log_warning "${service} Podが見つかりません"
        fi
    done
}

# システム状態バックアップ
backup_system_state() {
    log_header "システム状態バックアップ"
    
    local state_dir="${BACKUP_DIR}/system_state"
    mkdir -p "${state_dir}"
    
    log_info "Pod状態をバックアップ中..."
    kubectl get pods -n ${NAMESPACE} -o wide > "${state_dir}/pods_$(date +%Y%m%d_%H%M%S).txt"
    
    log_info "イベントをバックアップ中..."
    kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp' > "${state_dir}/events_$(date +%Y%m%d_%H%M%S).txt"
    
    log_info "ノード状態をバックアップ中..."
    kubectl get nodes -o wide > "${state_dir}/nodes_$(date +%Y%m%d_%H%M%S).txt"
    
    log_info "リソース使用量をバックアップ中..."
    kubectl top nodes > "${state_dir}/node_usage_$(date +%Y%m%d_%H%M%S).txt" 2>/dev/null || true
    kubectl top pods -n ${NAMESPACE} > "${state_dir}/pod_usage_$(date +%Y%m%d_%H%M%S).txt" 2>/dev/null || true
    
    log_success "システム状態バックアップ完了"
}

# バックアップ圧縮
compress_backup() {
    log_header "バックアップ圧縮"
    
    local archive_name="k8s_backup_$(basename ${BACKUP_DIR}).tar.gz"
    local archive_path="$(dirname ${BACKUP_DIR})/${archive_name}"
    
    log_info "バックアップを圧縮中..."
    tar -czf "${archive_path}" -C "$(dirname ${BACKUP_DIR})" "$(basename ${BACKUP_DIR})"
    
    # 元のディレクトリを削除
    rm -rf "${BACKUP_DIR}"
    
    log_success "バックアップ圧縮完了: ${archive_path}"
    echo "アーカイブサイズ: $(du -h ${archive_path} | cut -f1)"
    
    # S3アップロード（設定されている場合）
    if [[ -n "$S3_BUCKET" ]]; then
        upload_to_s3 "${archive_path}"
    fi
}

# S3にアップロード
upload_to_s3() {
    local archive_path="$1"
    
    log_header "S3アップロード"
    
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI が見つかりません。S3アップロードをスキップします"
        return
    fi
    
    log_info "S3にアップロード中: ${S3_BUCKET}"
    
    local s3_key="k8s-backups/$(basename ${archive_path})"
    
    if aws s3 cp "${archive_path}" "s3://${S3_BUCKET}/${s3_key}"; then
        log_success "S3アップロード完了: s3://${S3_BUCKET}/${s3_key}"
        
        # 古いバックアップを削除
        cleanup_old_backups_s3
    else
        log_error "S3アップロードに失敗しました"
    fi
}

# S3の古いバックアップを削除
cleanup_old_backups_s3() {
    log_info "古いS3バックアップを削除中（${RETENTION_DAYS}日以上前）..."
    
    local cutoff_date=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)
    
    aws s3api list-objects --bucket "${S3_BUCKET}" --prefix "k8s-backups/" --query "Contents[?LastModified<='${cutoff_date}'].Key" --output text | \
    while read -r key; do
        if [[ -n "$key" && "$key" != "None" ]]; then
            aws s3 rm "s3://${S3_BUCKET}/${key}"
            log_info "削除: s3://${S3_BUCKET}/${key}"
        fi
    done
}

# ローカルの古いバックアップを削除
cleanup_old_backups_local() {
    log_header "ローカルバックアップクリーンアップ"
    
    local backup_base_dir="$(dirname ${BACKUP_DIR})"
    
    log_info "古いローカルバックアップを削除中（${RETENTION_DAYS}日以上前）..."
    
    find "${backup_base_dir}" -name "k8s_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -exec rm -f {} \; 2>/dev/null || true
    
    log_success "ローカルバックアップクリーンアップ完了"
}

# 全体バックアップ
backup_all() {
    backup_kubernetes_configs
    backup_databases
    backup_kafka
    backup_logs
    backup_system_state
}

# 使用法表示
show_usage() {
    echo "使用法: $0 [オプション]"
    echo
    echo "オプション:"
    echo "  configs    - Kubernetes設定のみバックアップ"
    echo "  database   - データベースのみバックアップ"
    echo "  kafka      - Kafkaデータのみバックアップ"
    echo "  logs       - ログのみバックアップ"
    echo "  state      - システム状態のみバックアップ"
    echo "  all        - 全てをバックアップ (デフォルト)"
    echo "  help       - この使用法を表示"
    echo
    echo "環境変数:"
    echo "  K8S_BACKUP_S3_BUCKET    - S3バケット名（オプション）"
    echo "  BACKUP_RETENTION_DAYS   - 保持日数（デフォルト: 7日）"
    echo
    echo "例:"
    echo "  $0 all"
    echo "  $0 database"
    echo "  K8S_BACKUP_S3_BUCKET=my-backup-bucket $0 all"
}

# メイン処理
main() {
    echo -e "${PURPLE}本番環境バックアップツール${NC}"
    echo "対象ネームスペース: ${NAMESPACE}"
    echo "バックアップ開始時刻: $(date)"
    echo "保持日数: ${RETENTION_DAYS}日"
    [[ -n "$S3_BUCKET" ]] && echo "S3バケット: ${S3_BUCKET}"
    echo
    
    check_prerequisites
    
    case "${1:-all}" in
        "configs")
            backup_kubernetes_configs
            ;;
        "database")
            backup_databases
            ;;
        "kafka")
            backup_kafka
            ;;
        "logs")
            backup_logs
            ;;
        "state")
            backup_system_state
            ;;
        "all")
            backup_all
            ;;
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
    
    # バックアップが作成された場合のみ圧縮
    if [[ -d "${BACKUP_DIR}" ]]; then
        compress_backup
        cleanup_old_backups_local
    fi
    
    echo
    log_success "バックアップ完了: $(date)"
    log_info "実行時間: $((SECONDS/60))分$((SECONDS%60))秒"
}

# スクリプト実行
main "$@"
