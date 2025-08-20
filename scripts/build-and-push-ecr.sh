#!/bin/bash

# AWS ECR用のビルド・プッシュスクリプト
# Build and Push Script for AWS ECR

set -e

# 設定変数
AWS_REGION=${AWS_REGION:-"us-west-2"}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}
PROJECT_NAME=${PROJECT_NAME:-"ecommerce"}
VERSION=${VERSION:-$(git rev-parse --short HEAD)}

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ECRリポジトリのセットアップ
setup_ecr_repositories() {
    log_info "ECRリポジトリをセットアップしています..."
    
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service" "customer-frontend" "admin-frontend")
    
    for service in "${services[@]}"; do
        local repo_name="$PROJECT_NAME/$service"
        
        # リポジトリの存在確認
        if aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" &>/dev/null; then
            log_info "ECRリポジトリ $repo_name は既に存在します"
        else
            log_info "ECRリポジトリ $repo_name を作成しています..."
            aws ecr create-repository \
                --repository-name "$repo_name" \
                --region "$AWS_REGION" \
                --image-scanning-configuration scanOnPush=true \
                --encryption-configuration encryptionType=AES256 > /dev/null
            log_success "ECRリポジトリ $repo_name を作成しました"
        fi
    done
}

# ECRログイン
ecr_login() {
    log_info "ECRにログインしています..."
    aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    log_success "ECRログイン完了"
}

# Dockerイメージのビルドとプッシュ
build_and_push_services() {
    log_info "マイクロサービスのDockerイメージをビルドしています..."
    
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service")
    local registry_url="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    for service in "${services[@]}"; do
        log_info "Building $service..."
        
        local image_tag="$registry_url/$PROJECT_NAME/$service:$VERSION"
        local latest_tag="$registry_url/$PROJECT_NAME/$service:latest"
        
        # サービスディレクトリに移動してビルド
        (
            cd "services/$service"
            
            # Dockerfileが存在するか確認
            if [[ ! -f "Dockerfile" ]]; then
                log_error "Dockerfile not found in services/$service"
                exit 1
            fi
            
            # マルチプラットフォームビルド（本番環境でARM64を使用する場合）
            docker buildx build \
                --platform linux/amd64,linux/arm64 \
                -t "$image_tag" \
                -t "$latest_tag" \
                --push .
        )
        
        log_success "$service イメージをプッシュしました"
        log_info "  - $image_tag"
        log_info "  - $latest_tag"
    done
}

# フロントエンドイメージのビルドとプッシュ
build_and_push_frontends() {
    log_info "フロントエンドのDockerイメージをビルドしています..."
    
    local frontend_apps=("customer" "admin")
    local registry_url="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    for app in "${frontend_apps[@]}"; do
        log_info "Building $app-frontend..."
        
        local image_tag="$registry_url/$PROJECT_NAME/$app-frontend:$VERSION"
        local latest_tag="$registry_url/$PROJECT_NAME/$app-frontend:latest"
        
        (
            cd "frontend/$app"
            
            if [[ ! -f "Dockerfile" ]]; then
                log_error "Dockerfile not found in frontend/$app"
                exit 1
            fi
            
            # ビルド時に本番用環境変数を設定
            docker buildx build \
                --platform linux/amd64,linux/arm64 \
                --build-arg NODE_ENV=production \
                --build-arg NEXT_PUBLIC_API_BASE_URL="https://api.your-domain.com" \
                --build-arg NEXT_PUBLIC_WS_URL="wss://api.your-domain.com" \
                -t "$image_tag" \
                -t "$latest_tag" \
                --push .
        )
        
        log_success "$app-frontend イメージをプッシュしました"
        log_info "  - $image_tag"
        log_info "  - $latest_tag"
    done
}

# イメージの脆弱性スキャン
scan_images() {
    log_info "イメージの脆弱性スキャンを開始しています..."
    
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service" "customer-frontend" "admin-frontend")
    local critical_vulnerabilities=0
    
    for service in "${services[@]}"; do
        local repo_name="$PROJECT_NAME/$service"
        
        log_info "Scanning $service..."
        
        # スキャン結果を取得
        local scan_result
        scan_result=$(aws ecr describe-image-scan-findings \
            --repository-name "$repo_name" \
            --image-id imageTag="$VERSION" \
            --region "$AWS_REGION" \
            --query 'imageScanFindingsSummary.findingCounts' \
            --output json 2>/dev/null || echo '{}')
        
        # 重要度別の脆弱性カウント
        local critical_count=$(echo "$scan_result" | jq -r '.CRITICAL // 0')
        local high_count=$(echo "$scan_result" | jq -r '.HIGH // 0')
        local medium_count=$(echo "$scan_result" | jq -r '.MEDIUM // 0')
        
        if [[ "$critical_count" -gt 0 ]]; then
            log_error "$service: CRITICAL脆弱性 $critical_count 件発見"
            ((critical_vulnerabilities++))
        elif [[ "$high_count" -gt 0 ]]; then
            log_warning "$service: HIGH脆弱性 $high_count 件発見"
        else
            log_success "$service: 重大な脆弱性なし"
        fi
        
        log_info "$service 脆弱性サマリー: CRITICAL:$critical_count, HIGH:$high_count, MEDIUM:$medium_count"
    done
    
    if [[ $critical_vulnerabilities -gt 0 ]]; then
        log_error "CRITICAL脆弱性が発見されました。本番デプロイを中止することを推奨します。"
        read -p "続行しますか? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 使用方法表示
show_usage() {
    cat << EOF
AWS ECR ビルド・プッシュスクリプト

使用方法:
    $0 [OPTIONS]

オプション:
    -r, --region REGION      AWS リージョン (デフォルト: $AWS_REGION)
    -a, --account-id ID      AWS アカウントID (自動取得)
    -p, --project NAME       プロジェクト名 (デフォルト: $PROJECT_NAME)
    -v, --version TAG        バージョンタグ (デフォルト: $VERSION)
    -s, --scan              脆弱性スキャンを実行
    -h, --help              このヘルプを表示

例:
    $0                          # デフォルト設定でビルド・プッシュ
    $0 -v v1.2.3               # 特定バージョンでビルド
    $0 -s                       # 脆弱性スキャン付きでビルド
    $0 -r ap-northeast-1        # 特定リージョンでビルド

環境変数:
    AWS_REGION              - AWS リージョン
    AWS_ACCOUNT_ID          - AWS アカウントID
    PROJECT_NAME            - プロジェクト名
    VERSION                 - ビルドバージョン
EOF
}

# メイン処理
main() {
    local run_scan=false
    
    # 引数解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--region)
                AWS_REGION="$2"
                shift 2
                ;;
            -a|--account-id)
                AWS_ACCOUNT_ID="$2"
                shift 2
                ;;
            -p|--project)
                PROJECT_NAME="$2"
                shift 2
                ;;
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -s|--scan)
                run_scan=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # AWS CLI の確認
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI がインストールされていません"
        exit 1
    fi
    
    # Docker Buildx の確認
    if ! docker buildx version &> /dev/null; then
        log_error "Docker Buildx がインストールされていません"
        exit 1
    fi
    
    # AWS認証情報の確認
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS認証情報が設定されていません"
        exit 1
    fi
    
    # AWS アカウントIDの自動取得
    if [[ -z "$AWS_ACCOUNT_ID" ]]; then
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    fi
    
    log_info "AWS ECR ビルド・プッシュを開始します"
    log_info "Region: $AWS_REGION"
    log_info "Account ID: $AWS_ACCOUNT_ID"
    log_info "Project: $PROJECT_NAME"
    log_info "Version: $VERSION"
    echo
    
    # 実行
    setup_ecr_repositories
    ecr_login
    build_and_push_services
    build_and_push_frontends
    
    if [[ "$run_scan" == true ]]; then
        log_info "スキャン結果が反映されるまで少し待機します..."
        sleep 30
        scan_images
    fi
    
    log_success "すべてのイメージのビルド・プッシュが完了しました！"
    
    # プッシュされたイメージの一覧表示
    log_info "プッシュされたイメージ:"
    local services=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service" "customer-frontend" "admin-frontend")
    for service in "${services[@]}"; do
        echo "  - $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME/$service:$VERSION"
    done
}

# スクリプト実行
main "$@"
