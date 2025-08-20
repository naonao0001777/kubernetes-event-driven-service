#!/bin/bash

# 本番環境モニタリング・ヘルスチェックスクリプト
# Production Environment Monitoring and Health Check Script

set -e

# 設定変数
NAMESPACE=${NAMESPACE:-"production"}
CHECK_INTERVAL=${CHECK_INTERVAL:-30}
MAX_RETRIES=${MAX_RETRIES:-3}

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_monitor() { echo -e "${CYAN}[MONITOR]${NC} $1"; }

# 使用方法表示
show_usage() {
    cat << EOF
本番環境モニタリング・ヘルスチェックスクリプト

使用方法:
    $0 [OPTIONS] COMMAND

コマンド:
    health          - 全サービスのヘルスチェック
    status          - 現在の状態確認
    monitor         - 継続的監視（Ctrl+Cで停止）
    metrics         - パフォーマンスメトリクス表示
    logs            - エラーログの確認
    alerts          - アラート状況の確認

オプション:
    -n, --namespace NS       Kubernetesネームスペース (デフォルト: $NAMESPACE)
    -i, --interval SECONDS   監視間隔（秒） (デフォルト: $CHECK_INTERVAL)
    -r, --retries COUNT      リトライ回数 (デフォルト: $MAX_RETRIES)
    -h, --help              このヘルプを表示

例:
    $0 health                    # ヘルスチェック実行
    $0 monitor                   # 継続的監視開始
    $0 -i 60 monitor            # 60秒間隔で監視
    $0 -n staging status        # ステージング環境の状態確認
EOF
}

# サービス設定
declare -A SERVICE_PORTS=(
    ["order-service"]="8080"
    ["inventory-service"]="8081"
    ["payment-service"]="8082"
    ["notification-service"]="8083"
    ["shipping-service"]="8084"
    ["status-service"]="8085"
)

# ヘルスチェック実行
perform_health_check() {
    log_info "ヘルスチェックを実行しています..."
    
    local failed_services=()
    local total_services=${#SERVICE_PORTS[@]}
    local healthy_services=0
    
    for service in "${!SERVICE_PORTS[@]}"; do
        local port="${SERVICE_PORTS[$service]}"
        local health_status="UNKNOWN"
        
        # Podの状態確認
        local pod_status=$(kubectl get pods -l app="$service" -n "$NAMESPACE" -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "NotFound")
        
        if [[ "$pod_status" == "Running" ]]; then
            # ポートフォワードでヘルスチェック
            local pf_pid
            kubectl port-forward service/"$service" "$port:$port" -n "$NAMESPACE" &>/dev/null &
            pf_pid=$!
            
            sleep 2  # ポートフォワードの開始を待機
            
            # HTTPヘルスチェック
            local http_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" 2>/dev/null || echo "000")
            
            # ポートフォワード終了
            kill $pf_pid 2>/dev/null || true
            wait $pf_pid 2>/dev/null || true
            
            if [[ "$http_status" == "200" ]]; then
                health_status="HEALTHY"
                ((healthy_services++))
            else
                health_status="UNHEALTHY"
                failed_services+=("$service")
            fi
        else
            health_status="NOT_RUNNING"
            failed_services+=("$service")
        fi
        
        # 結果表示
        case $health_status in
            "HEALTHY")
                log_success "$service: $health_status (Pod: $pod_status, HTTP: $http_status)"
                ;;
            *)
                log_error "$service: $health_status (Pod: $pod_status)"
                ;;
        esac
    done
    
    echo
    log_info "ヘルスチェック結果: $healthy_services/$total_services サービスが正常"
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log_error "異常なサービス: ${failed_services[*]}"
        return 1
    else
        log_success "すべてのサービスが正常に動作しています"
        return 0
    fi
}

# 現在の状態確認
check_current_status() {
    log_info "現在の状態を確認しています..."
    
    echo "=== Pod状態 ==="
    kubectl get pods -n "$NAMESPACE" -o wide
    
    echo
    echo "=== Service状態 ==="
    kubectl get services -n "$NAMESPACE"
    
    echo
    echo "=== Deployment状態 ==="
    kubectl get deployments -n "$NAMESPACE"
    
    echo
    echo "=== HPA状態 ==="
    kubectl get hpa -n "$NAMESPACE" 2>/dev/null || echo "HPA設定なし"
    
    echo
    echo "=== PVC状態 ==="
    kubectl get pvc -n "$NAMESPACE" 2>/dev/null || echo "PVC設定なし"
    
    echo
    echo "=== イベント ==="
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -10
}

# パフォーマンスメトリクス表示
show_metrics() {
    log_info "パフォーマンスメトリクスを表示しています..."
    
    echo "=== CPU・メモリ使用量 ==="
    kubectl top pods -n "$NAMESPACE" 2>/dev/null || log_warning "Metrics Serverが利用できません"
    
    echo
    echo "=== ノード使用量 ==="
    kubectl top nodes 2>/dev/null || log_warning "ノードメトリクスが利用できません"
    
    # 各サービスのレプリカ数とリソース制限
    echo
    echo "=== サービス詳細 ==="
    for service in "${!SERVICE_PORTS[@]}"; do
        local replicas=$(kubectl get deployment "$service" -n "$NAMESPACE" -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
        local available=$(kubectl get deployment "$service" -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo "0")
        local cpu_request=$(kubectl get deployment "$service" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}' 2>/dev/null || echo "未設定")
        local memory_request=$(kubectl get deployment "$service" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}' 2>/dev/null || echo "未設定")
        
        echo "$service: $available/$replicas replicas (CPU: $cpu_request, Memory: $memory_request)"
    done
}

# エラーログ確認
check_error_logs() {
    log_info "エラーログを確認しています..."
    
    for service in "${!SERVICE_PORTS[@]}"; do
        echo
        echo "=== $service ログ (最新のエラー) ==="
        
        # エラーレベルのログを抽出
        local error_logs=$(kubectl logs -l app="$service" -n "$NAMESPACE" --tail=100 2>/dev/null | grep -i "error\|fatal\|panic" | tail -5 || echo "エラーログなし")
        
        if [[ "$error_logs" == "エラーログなし" ]]; then
            log_success "$service: エラーログなし"
        else
            log_warning "$service でエラーログを検出:"
            echo "$error_logs"
        fi
    done
}

# アラート状況確認
check_alerts() {
    log_info "アラート状況を確認しています..."
    
    local alerts_found=false
    
    # Podの再起動確認
    echo "=== Pod再起動確認 ==="
    local restart_check=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.containerStatuses[0].restartCount}{"\n"}{end}' | awk '$2 > 0')
    
    if [[ -n "$restart_check" ]]; then
        log_warning "再起動が発生したPod:"
        echo "$restart_check"
        alerts_found=true
    else
        log_success "Pod再起動なし"
    fi
    
    # Failed Podの確認
    echo
    echo "=== Failed Pod確認 ==="
    local failed_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed 2>/dev/null)
    
    if [[ -n "$failed_pods" && "$failed_pods" != *"No resources found"* ]]; then
        log_error "失敗したPodを検出:"
        echo "$failed_pods"
        alerts_found=true
    else
        log_success "失敗したPodなし"
    fi
    
    # リソース使用量アラート確認
    echo
    echo "=== リソース使用量アラート ==="
    
    # CPU使用量が80%を超えるPodを確認
    local high_cpu=$(kubectl top pods -n "$NAMESPACE" 2>/dev/null | awk 'NR>1 && $2 ~ /[0-9]+m/ {gsub(/m/, "", $2); if($2 > 800) print $1 " CPU: " $2 "m"}')
    
    if [[ -n "$high_cpu" ]]; then
        log_warning "高CPU使用率のPod:"
        echo "$high_cpu"
        alerts_found=true
    fi
    
    # メモリ使用量が80%を超えるPodを確認（簡易版）
    local high_memory=$(kubectl top pods -n "$NAMESPACE" 2>/dev/null | awk 'NR>1 && $3 ~ /[0-9]+Mi/ {gsub(/Mi/, "", $3); if($3 > 800) print $1 " Memory: " $3 "Mi"}')
    
    if [[ -n "$high_memory" ]]; then
        log_warning "高メモリ使用率のPod:"
        echo "$high_memory"
        alerts_found=true
    fi
    
    if [[ "$alerts_found" == false ]]; then
        log_success "アラート状況: 正常"
    else
        log_warning "アラートが検出されました。詳細を確認してください。"
    fi
}

# 継続的監視
continuous_monitoring() {
    log_info "継続的監視を開始します (間隔: ${CHECK_INTERVAL}秒, Ctrl+Cで停止)"
    echo
    
    local iteration=0
    
    while true; do
        ((iteration++))
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        
        echo "==================================================================="
        log_monitor "監視 #$iteration - $timestamp"
        echo "==================================================================="
        
        # ヘルスチェック実行
        if perform_health_check; then
            log_success "すべてのサービス正常"
        else
            log_error "一部サービスで問題を検出"
            
            # 問題がある場合は詳細情報を表示
            echo
            log_warning "詳細調査中..."
            check_error_logs
        fi
        
        echo
        log_info "次のチェックまで ${CHECK_INTERVAL}秒待機..."
        sleep "$CHECK_INTERVAL"
    done
}

# メイン処理
main() {
    local command=""
    
    # 引数解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -i|--interval)
                CHECK_INTERVAL="$2"
                shift 2
                ;;
            -r|--retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            health|status|monitor|metrics|logs|alerts)
                command="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    if [[ -z "$command" ]]; then
        log_error "コマンドが指定されていません"
        show_usage
        exit 1
    fi
    
    # kubectl の確認
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl がインストールされていません"
        exit 1
    fi
    
    # クラスター接続確認
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Kubernetesクラスターに接続できません"
        exit 1
    fi
    
    # ネームスペース存在確認
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "ネームスペース '$NAMESPACE' が存在しません"
        exit 1
    fi
    
    log_info "本番環境監視を開始します"
    log_info "Namespace: $NAMESPACE"
    log_info "Command: $command"
    echo
    
    case $command in
        health)
            perform_health_check
            ;;
        status)
            check_current_status
            ;;
        monitor)
            continuous_monitoring
            ;;
        metrics)
            show_metrics
            ;;
        logs)
            check_error_logs
            ;;
        alerts)
            check_alerts
            ;;
        *)
            log_error "Unknown command: $command"
            exit 1
            ;;
    esac
}

# SIGINT (Ctrl+C) ハンドラー
trap 'echo -e "\n${YELLOW}[INFO]${NC} 監視を停止します..."; exit 0' INT

# スクリプト実行
main "$@"
