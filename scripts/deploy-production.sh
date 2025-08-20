#!/bin/bash

# 本番環境デプロイメントスクリプト
# Production Deployment Script for Event-Driven E-Commerce Microservices

set -e

# 設定変数
REGISTRY_URL=${REGISTRY_URL:-"your-registry.com"}
PROJECT_NAME=${PROJECT_NAME:-"ecommerce"}
VERSION=${VERSION:-$(git rev-parse --short HEAD)}
NAMESPACE=${NAMESPACE:-"production"}

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ヘルプ表示
show_help() {
    cat << EOF
本番環境デプロイメントスクリプト

使用方法:
    $0 [OPTIONS] COMMAND

コマンド:
    check       - 前提条件のチェック
    build       - Dockerイメージのビルドとプッシュ
    deploy      - Kubernetesへのデプロイ
    verify      - デプロイメントの検証
    rollback    - 前のバージョンへのロールバック
    all         - 全工程の実行 (check → build → deploy → verify)

オプション:
    -r, --registry URL    レジストリURL (デフォルト: $REGISTRY_URL)
    -v, --version TAG     バージョンタグ (デフォルト: $VERSION)
    -n, --namespace NS    Kubernetesネームスペース (デフォルト: $NAMESPACE)
    -h, --help           このヘルプを表示

例:
    $0 all                              # 全工程実行
    $0 -r gcr.io/my-project build       # 特定レジストリでビルド
    $0 -v v1.2.3 deploy                 # 特定バージョンでデプロイ
    $0 verify                           # デプロイメント検証のみ

環境変数:
    REGISTRY_URL         - Dockerレジストリ URL
    REGISTRY_USERNAME    - レジストリユーザー名
    REGISTRY_PASSWORD    - レジストリパスワード
    PROJECT_NAME         - プロジェクト名
    VERSION              - デプロイバージョン
    NAMESPACE            - Kubernetesネームスペース
EOF
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェックしています..."
    
    # 必要なコマンドの確認
    local required_commands=("docker" "kubectl" "git")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd がインストールされていません"
            exit 1
        fi
    done
    
    # Docker デーモンの確認
    if ! docker info &> /dev/null; then
        log_error "Docker デーモンが起動していません"
        exit 1
    fi
    
    # kubectl接続確認
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Kubernetesクラスターに接続できません"
        exit 1
    fi
    
    # Git リポジトリの確認
    if ! git rev-parse --git-dir &> /dev/null; then
        log_error "Gitリポジトリではありません"
        exit 1
    fi
    
    # 未コミットの変更確認
    if [[ -n $(git status --porcelain) ]]; then
        log_warning "未コミットの変更があります"
        read -p "続行しますか? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "前提条件チェック完了"
}

# Dockerイメージのビルドとプッシュ
build_and_push() {
    log_info "Dockerイメージをビルドしています..."
    
    # レジストリログイン
    if [[ -n "$REGISTRY_USERNAME" && -n "$REGISTRY_PASSWORD" ]]; then
        echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY_URL" -u "$REGISTRY_USERNAME" --password-stdin
    fi
    
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service")
    
    for service in "${services[@]}"; do
        log_info "Building $service..."
        
        local image_tag="$REGISTRY_URL/$PROJECT_NAME/$service:$VERSION"
        local latest_tag="$REGISTRY_URL/$PROJECT_NAME/$service:latest"
        
        # サービスディレクトリに移動してビルド
        (
            cd "services/$service"
            docker build -t "$image_tag" -t "$latest_tag" .
            docker push "$image_tag"
            docker push "$latest_tag"
        )
        
        log_success "$service イメージをプッシュしました: $image_tag"
    done
    
    # フロントエンドイメージのビルド
    local frontend_apps=("customer" "admin")
    for app in "${frontend_apps[@]}"; do
        log_info "Building frontend/$app..."
        
        local image_tag="$REGISTRY_URL/$PROJECT_NAME/$app-frontend:$VERSION"
        local latest_tag="$REGISTRY_URL/$PROJECT_NAME/$app-frontend:latest"
        
        (
            cd "frontend/$app"
            docker build -t "$image_tag" -t "$latest_tag" .
            docker push "$image_tag"
            docker push "$latest_tag"
        )
        
        log_success "$app-frontend イメージをプッシュしました: $image_tag"
    done
}

# Kubernetesへのデプロイ
deploy_to_kubernetes() {
    log_info "Kubernetesにデプロイしています..."
    
    # ネームスペースの作成
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Kafkaのデプロイ
    log_info "Kafka（Strimzi）をデプロイしています..."
    kubectl apply -f deploy/k8s/kafka/ -n "$NAMESPACE"
    
    # Kafka準備完了まで待機
    log_info "Kafkaクラスターの準備完了を待機しています..."
    kubectl wait kafka/my-cluster --for=condition=Ready --timeout=600s -n "$NAMESPACE" || {
        log_warning "Kafkaの準備に時間がかかっています。手動で確認してください。"
    }
    
    # イメージタグを更新してマイクロサービスをデプロイ
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service")
    
    for service in "${services[@]}"; do
        log_info "Deploying $service..."
        
        # deployment.yamlのイメージタグを更新
        local deployment_file="deploy/k8s/$service/deployment.yaml"
        if [[ -f "$deployment_file" ]]; then
            # 一時ファイルを作成してイメージタグを置換
            sed "s|image: .*$service.*|image: $REGISTRY_URL/$PROJECT_NAME/$service:$VERSION|g" "$deployment_file" | \
            kubectl apply -f - -n "$NAMESPACE"
        else
            log_warning "$deployment_file が見つかりません"
        fi
    done
    
    # フロントエンドのデプロイ
    log_info "フロントエンドをデプロイしています..."
    local frontend_files=(deploy/k8s/frontend/*.yaml)
    for file in "${frontend_files[@]}"; do
        if [[ -f "$file" ]]; then
            # イメージタグを更新してデプロイ
            sed -e "s|image: .*customer-frontend.*|image: $REGISTRY_URL/$PROJECT_NAME/customer-frontend:$VERSION|g" \
                -e "s|image: .*admin-frontend.*|image: $REGISTRY_URL/$PROJECT_NAME/admin-frontend:$VERSION|g" \
                "$file" | kubectl apply -f - -n "$NAMESPACE"
        fi
    done
    
    log_success "Kubernetesデプロイメント完了"
}

# デプロイメント検証
verify_deployment() {
    log_info "デプロイメントを検証しています..."
    
    # Pod状態の確認
    log_info "Pod状態を確認しています..."
    kubectl get pods -n "$NAMESPACE"
    
    # すべてのDeploymentが準備完了まで待機
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service")
    
    for service in "${services[@]}"; do
        log_info "Waiting for $service to be ready..."
        kubectl wait deployment/$service --for=condition=Available --timeout=300s -n "$NAMESPACE" || {
            log_error "$service のデプロイメントが失敗しました"
            kubectl describe deployment/$service -n "$NAMESPACE"
            kubectl logs -l app=$service -n "$NAMESPACE" --tail=50
            exit 1
        }
    done
    
    # ヘルスチェック
    log_info "ヘルスチェックを実行しています..."
    local health_checks_passed=0
    local total_services=${#services[@]}
    
    # ポートフォワードを設定してヘルスチェック
    for service in "${services[@]}"; do
        local port
        case $service in
            "order-service") port=8080 ;;
            "inventory-service") port=8081 ;;
            "payment-service") port=8082 ;;
            "notification-service") port=8083 ;;
            "shipping-service") port=8084 ;;
            "status-service") port=8085 ;;
        esac
        
        # バックグラウンドでポートフォワード
        kubectl port-forward service/$service $port:$port -n "$NAMESPACE" &
        local pf_pid=$!
        
        sleep 5  # ポートフォワードの開始を待機
        
        # ヘルスチェック実行
        if curl -f -s "http://localhost:$port/health" > /dev/null; then
            log_success "$service ヘルスチェック OK"
            ((health_checks_passed++))
        else
            log_error "$service ヘルスチェック 失敗"
        fi
        
        # ポートフォワード終了
        kill $pf_pid 2>/dev/null || true
        wait $pf_pid 2>/dev/null || true
    done
    
    # 結果サマリー
    if [[ $health_checks_passed -eq $total_services ]]; then
        log_success "すべてのサービスが正常に動作しています ($health_checks_passed/$total_services)"
    else
        log_error "一部のサービスでヘルスチェックが失敗しました ($health_checks_passed/$total_services)"
        exit 1
    fi
    
    # サービスURL表示
    log_info "デプロイされたサービス:"
    kubectl get services -n "$NAMESPACE"
    
    log_success "デプロイメント検証完了"
}

# ロールバック
rollback_deployment() {
    log_warning "ロールバックを実行しています..."
    
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service")
    
    for service in "${services[@]}"; do
        log_info "Rolling back $service..."
        kubectl rollout undo deployment/$service -n "$NAMESPACE"
        kubectl rollout status deployment/$service -n "$NAMESPACE"
    done
    
    log_success "ロールバック完了"
}

# メイン処理
main() {
    local command=""
    
    # 引数解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--registry)
                REGISTRY_URL="$2"
                shift 2
                ;;
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            check|build|deploy|verify|rollback|all)
                command="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    if [[ -z "$command" ]]; then
        log_error "コマンドが指定されていません"
        show_help
        exit 1
    fi
    
    log_info "本番デプロイメントを開始します..."
    log_info "Registry: $REGISTRY_URL"
    log_info "Project: $PROJECT_NAME"
    log_info "Version: $VERSION"
    log_info "Namespace: $NAMESPACE"
    echo
    
    case $command in
        check)
            check_prerequisites
            ;;
        build)
            check_prerequisites
            build_and_push
            ;;
        deploy)
            check_prerequisites
            deploy_to_kubernetes
            ;;
        verify)
            verify_deployment
            ;;
        rollback)
            rollback_deployment
            ;;
        all)
            check_prerequisites
            build_and_push
            deploy_to_kubernetes
            verify_deployment
            ;;
        *)
            log_error "Unknown command: $command"
            exit 1
            ;;
    esac
    
    log_success "操作が完了しました！"
}

# スクリプト実行
main "$@"
