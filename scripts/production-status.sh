#!/bin/bash

# production-status.sh - 本番環境状態確認スクリプト
# 使用法: ./scripts/production-status.sh [check|logs|metrics|all]

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
SERVICES=("order-service" "payment-service" "inventory-service" "shipping-service" "notification-service" "status-service")

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

# 基本チェック関数
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
    
    log_success "前提条件OK"
}

# ネームスペース状態確認
check_namespace() {
    log_header "ネームスペース状態確認"
    
    if kubectl get namespace ${NAMESPACE} &> /dev/null; then
        log_success "ネームスペース '${NAMESPACE}' が存在します"
        
        # リソースクォータ確認
        echo -e "\n${YELLOW}リソースクォータ:${NC}"
        kubectl get resourcequota -n ${NAMESPACE} -o wide 2>/dev/null || log_warning "リソースクォータが設定されていません"
        
        # ネットワークポリシー確認
        echo -e "\n${YELLOW}ネットワークポリシー:${NC}"
        kubectl get networkpolicy -n ${NAMESPACE} 2>/dev/null || log_warning "ネットワークポリシーが設定されていません"
        
    else
        log_error "ネームスペース '${NAMESPACE}' が存在しません"
        return 1
    fi
}

# Pod状態確認
check_pods() {
    log_header "Pod状態確認"
    
    echo -e "${YELLOW}全Pod状態:${NC}"
    kubectl get pods -n ${NAMESPACE} -o wide
    
    echo -e "\n${YELLOW}準備できていないPod:${NC}"
    not_ready=$(kubectl get pods -n ${NAMESPACE} --field-selector=status.phase!=Running -o name 2>/dev/null || true)
    if [[ -n "$not_ready" ]]; then
        echo "$not_ready"
        log_warning "準備できていないPodがあります"
    else
        log_success "全てのPodが準備完了しています"
    fi
    
    echo -e "\n${YELLOW}再起動回数:${NC}"
    kubectl get pods -n ${NAMESPACE} -o custom-columns="NAME:.metadata.name,RESTARTS:.status.containerStatuses[*].restartCount"
    
    # 各サービスの詳細確認
    for service in "${SERVICES[@]}"; do
        echo -e "\n${YELLOW}${service} の詳細:${NC}"
        pods=$(kubectl get pods -n ${NAMESPACE} -l app=${service} -o name 2>/dev/null || true)
        if [[ -n "$pods" ]]; then
            for pod in $pods; do
                kubectl describe $pod -n ${NAMESPACE} | grep -E "(Status|Ready|Restarts|Events)" | tail -10
            done
        else
            log_warning "${service} のPodが見つかりません"
        fi
    done
}

# サービス状態確認
check_services() {
    log_header "サービス状態確認"
    
    echo -e "${YELLOW}全サービス:${NC}"
    kubectl get services -n ${NAMESPACE} -o wide
    
    echo -e "\n${YELLOW}エンドポイント確認:${NC}"
    kubectl get endpoints -n ${NAMESPACE}
    
    # 各サービスのヘルスチェック
    for service in "${SERVICES[@]}"; do
        echo -e "\n${YELLOW}${service} ヘルスチェック:${NC}"
        
        # サービスが存在するかチェック
        if kubectl get service ${service} -n ${NAMESPACE} &> /dev/null; then
            # ポートフォワードでヘルスチェック
            pod=$(kubectl get pods -n ${NAMESPACE} -l app=${service} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
            if [[ -n "$pod" ]]; then
                timeout 10s kubectl port-forward -n ${NAMESPACE} ${pod} 18080:8080 &> /dev/null &
                port_forward_pid=$!
                sleep 2
                
                if curl -s http://localhost:18080/health &> /dev/null; then
                    log_success "${service} は正常に応答しています"
                else
                    log_warning "${service} からの応答がありません"
                fi
                
                kill ${port_forward_pid} 2>/dev/null || true
            else
                log_warning "${service} のPodが見つかりません"
            fi
        else
            log_warning "${service} サービスが存在しません"
        fi
    done
}

# Deployment状態確認
check_deployments() {
    log_header "Deployment状態確認"
    
    echo -e "${YELLOW}全Deployment:${NC}"
    kubectl get deployments -n ${NAMESPACE} -o wide
    
    echo -e "\n${YELLOW}Deployment詳細:${NC}"
    for service in "${SERVICES[@]}"; do
        if kubectl get deployment ${service} -n ${NAMESPACE} &> /dev/null; then
            echo -e "\n${YELLOW}${service}:${NC}"
            kubectl rollout status deployment/${service} -n ${NAMESPACE} --timeout=10s || log_warning "${service} のロールアウトが完了していません"
        fi
    done
}

# HPA状態確認
check_hpa() {
    log_header "HPA状態確認"
    
    if kubectl get hpa -n ${NAMESPACE} &> /dev/null; then
        echo -e "${YELLOW}HPA状態:${NC}"
        kubectl get hpa -n ${NAMESPACE} -o wide
        
        echo -e "\n${YELLOW}HPA詳細:${NC}"
        for service in "${SERVICES[@]}"; do
            if kubectl get hpa ${service}-hpa -n ${NAMESPACE} &> /dev/null; then
                echo -e "\n${service}:"
                kubectl describe hpa ${service}-hpa -n ${NAMESPACE} | grep -E "(Current|Target|Min|Max)"
            fi
        done
    else
        log_warning "HPAが設定されていません"
    fi
}

# Kafka状態確認
check_kafka() {
    log_header "Kafka状態確認"
    
    # Kafka Pod確認
    kafka_pods=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=kafka -o name 2>/dev/null || true)
    if [[ -n "$kafka_pods" ]]; then
        echo -e "${YELLOW}Kafka Pod状態:${NC}"
        kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=kafka
        
        # Kafka接続テスト
        echo -e "\n${YELLOW}Kafka接続テスト:${NC}"
        kafka_pod=$(kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=kafka -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
        if [[ -n "$kafka_pod" ]]; then
            timeout 30s kubectl exec -n ${NAMESPACE} ${kafka_pod} -- kafka-topics.sh --bootstrap-server localhost:9092 --list &> /dev/null && \
                log_success "Kafkaに接続できます" || \
                log_warning "Kafkaへの接続に問題があります"
        fi
    else
        log_warning "Kafka Podが見つかりません"
    fi
}

# ログ確認
check_logs() {
    log_header "最近のログ確認"
    
    for service in "${SERVICES[@]}"; do
        echo -e "\n${YELLOW}${service} の最新ログ (最新10行):${NC}"
        pod=$(kubectl get pods -n ${NAMESPACE} -l app=${service} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
        if [[ -n "$pod" ]]; then
            kubectl logs ${pod} -n ${NAMESPACE} --tail=10 --since=1h 2>/dev/null || log_warning "${service} のログを取得できません"
        else
            log_warning "${service} のPodが見つかりません"
        fi
    done
    
    # エラーログの検索
    echo -e "\n${YELLOW}最近のエラーログ:${NC}"
    for service in "${SERVICES[@]}"; do
        pod=$(kubectl get pods -n ${NAMESPACE} -l app=${service} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
        if [[ -n "$pod" ]]; then
            errors=$(kubectl logs ${pod} -n ${NAMESPACE} --since=1h 2>/dev/null | grep -i "error\|exception\|panic\|fatal" | tail -3 || true)
            if [[ -n "$errors" ]]; then
                echo -e "\n${RED}${service} エラー:${NC}"
                echo "$errors"
            fi
        fi
    done
}

# メトリクス確認
check_metrics() {
    log_header "リソースメトリクス確認"
    
    # Node使用率
    echo -e "${YELLOW}Node使用率:${NC}"
    kubectl top nodes 2>/dev/null || log_warning "Node使用率を取得できません (metrics-server が必要)"
    
    # Pod使用率
    echo -e "\n${YELLOW}Pod使用率:${NC}"
    kubectl top pods -n ${NAMESPACE} 2>/dev/null || log_warning "Pod使用率を取得できません (metrics-server が必要)"
    
    # ストレージ使用量
    echo -e "\n${YELLOW}PVC使用状況:${NC}"
    kubectl get pvc -n ${NAMESPACE} 2>/dev/null || log_warning "PVCが見つかりません"
}

# 設定確認
check_config() {
    log_header "設定確認"
    
    # ConfigMap確認
    echo -e "${YELLOW}ConfigMap:${NC}"
    kubectl get configmaps -n ${NAMESPACE}
    
    # Secret確認
    echo -e "\n${YELLOW}Secret:${NC}"
    kubectl get secrets -n ${NAMESPACE}
    
    # 環境変数確認（サンプル）
    echo -e "\n${YELLOW}環境変数サンプル (order-service):${NC}"
    pod=$(kubectl get pods -n ${NAMESPACE} -l app=order-service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [[ -n "$pod" ]]; then
        kubectl exec ${pod} -n ${NAMESPACE} -- env | grep -E "KAFKA|DATABASE|SERVICE" | head -5 2>/dev/null || true
    fi
}

# 総合確認
check_all() {
    check_namespace
    check_pods
    check_services
    check_deployments
    check_hpa
    check_kafka
    check_config
}

# 簡易確認
quick_check() {
    log_header "簡易状態確認"
    
    # 基本的な状態確認
    echo -e "${YELLOW}ネームスペース:${NC}"
    kubectl get namespace ${NAMESPACE} 2>/dev/null && log_success "ネームスペース OK" || log_error "ネームスペース NG"
    
    echo -e "\n${YELLOW}全体的なPod状態:${NC}"
    ready_pods=$(kubectl get pods -n ${NAMESPACE} --field-selector=status.phase=Running -o name 2>/dev/null | wc -l)
    total_pods=$(kubectl get pods -n ${NAMESPACE} -o name 2>/dev/null | wc -l)
    echo "準備完了: ${ready_pods}/${total_pods}"
    
    if [[ $ready_pods -eq $total_pods ]] && [[ $total_pods -gt 0 ]]; then
        log_success "全てのPodが正常です"
    else
        log_warning "一部のPodに問題があります"
    fi
    
    echo -e "\n${YELLOW}サービス数:${NC}"
    service_count=$(kubectl get services -n ${NAMESPACE} -o name 2>/dev/null | wc -l)
    echo "サービス数: ${service_count}"
}

# 使用法表示
show_usage() {
    echo "使用法: $0 [オプション]"
    echo
    echo "オプション:"
    echo "  check        - 簡易状態確認"
    echo "  pods         - Pod詳細確認"
    echo "  services     - サービス状態確認"
    echo "  deployments  - Deployment状態確認"
    echo "  hpa          - HPA状態確認"
    echo "  kafka        - Kafka状態確認"
    echo "  logs         - ログ確認"
    echo "  metrics      - メトリクス確認"
    echo "  config       - 設定確認"
    echo "  all          - 全ての確認"
    echo "  help         - この使用法を表示"
    echo
    echo "例:"
    echo "  $0 check"
    echo "  $0 all"
    echo "  $0 logs"
}

# メイン処理
main() {
    echo -e "${PURPLE}本番環境状態確認ツール${NC}"
    echo "対象ネームスペース: ${NAMESPACE}"
    echo "確認時刻: $(date)"
    echo
    
    check_prerequisites
    
    case "${1:-check}" in
        "check")
            quick_check
            ;;
        "pods")
            check_pods
            ;;
        "services")
            check_services
            ;;
        "deployments")
            check_deployments
            ;;
        "hpa")
            check_hpa
            ;;
        "kafka")
            check_kafka
            ;;
        "logs")
            check_logs
            ;;
        "metrics")
            check_metrics
            ;;
        "config")
            check_config
            ;;
        "all")
            check_all
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
    
    echo
    log_info "確認完了: $(date)"
}

# スクリプト実行
main "$@"
