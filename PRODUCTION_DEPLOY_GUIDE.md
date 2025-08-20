# 本番デプロイメント実行ガイド

## 前提条件確認

### 1. 必要なツールのインストール確認
```bash
# 各ツールのバージョン確認
kubectl version --client
docker --version
git --version
aws --version  # AWS使用時のみ
```

### 2. 認証情報の設定
```bash
# Kubernetesクラスター接続確認
kubectl cluster-info

# AWS認証確認（AWS使用時のみ）
aws sts get-caller-identity

# Docker Hub認証（必要に応じて）
docker login
```

### 3. 環境変数設定
```bash
# 本番デプロイ用環境変数設定
export ENVIRONMENT=production
export AWS_REGION=ap-northeast-1  # 使用するAWSリージョン
export ECR_REGISTRY=your-account.dkr.ecr.ap-northeast-1.amazonaws.com
```

## 本番デプロイメント実行手順

### 【ステップ1】本番環境への初回デプロイ

```bash
# 1. プロジェクトディレクトリに移動
cd /Users/naohiro/dev/src/kubernetes-event-driven-service

# 2. 本番デプロイメントスクリプト実行
./scripts/deploy-production.sh all

# または段階的に実行
./scripts/deploy-production.sh check      # 前提条件チェック
./scripts/deploy-production.sh build      # ビルドとプッシュ
./scripts/deploy-production.sh deploy     # Kubernetesにデプロイ
./scripts/deploy-production.sh verify     # デプロイ確認
```

### 【ステップ2】デプロイ状態確認

```bash
# 本番環境の状態確認
./scripts/production-status.sh all

# 簡易確認
./scripts/production-status.sh check

# 特定コンポーネントの確認
./scripts/production-status.sh pods
./scripts/production-status.sh services
./scripts/production-status.sh kafka
```

### 【ステップ3】監視とヘルスチェック

```bash
# 本番環境監視開始
./scripts/monitor-production.sh

# 継続監視（バックグラウンド実行）
nohup ./scripts/monitor-production.sh continuous > monitoring.log 2>&1 &
```

### 【ステップ4】フロントエンドデプロイ

#### Vercelへのデプロイ
```bash
# Customer フロントエンドデプロイ
cd frontend/customer
npm install
npx vercel --prod

# Admin フロントエンドデプロイ
cd ../admin
npm install
npx vercel --prod
```

#### Kubernetesへのフロントエンドデプロイ
```bash
# フロントエンドコンテナビルドとデプロイ
./scripts/deploy-production.sh frontend
```

## トラブルシューティング

### デプロイ失敗時の対処

1. **前提条件エラーの場合**
```bash
# ツールインストール状況確認
./scripts/deploy-production.sh check

# 不足しているツールをインストール
# kubectl, docker, aws-cli等
```

2. **ビルドエラーの場合**
```bash
# ローカルでのビルドテスト
docker build -t test-build services/order-service

# 依存関係確認
cd services/order-service
go mod tidy
go build .
```

3. **デプロイエラーの場合**
```bash
# Kubernetesクラスター状態確認
kubectl get nodes
kubectl get namespaces

# 詳細なエラーログ確認
kubectl describe pods -n production
kubectl logs -n production -l app=order-service
```

4. **ロールバックが必要な場合**
```bash
# 自動ロールバック実行
./scripts/deploy-production.sh rollback

# 手動ロールバック
kubectl rollout undo deployment/order-service -n production
```

### パフォーマンス問題の対処

```bash
# リソース使用状況確認
./scripts/production-status.sh metrics

# HPA状態確認
kubectl get hpa -n production

# ログでボトルネック特定
./scripts/production-status.sh logs
```

## バックアップとメンテナンス

### 定期バックアップ設定

```bash
# 手動バックアップ実行
./scripts/backup-production.sh all

# S3への自動バックアップ設定
export K8S_BACKUP_S3_BUCKET=your-backup-bucket
./scripts/backup-production.sh all

# crontabで定期実行設定
crontab -e
# 例: 毎日午前2時にバックアップ実行
0 2 * * * /path/to/kubernetes-event-driven-service/scripts/backup-production.sh all
```

### メンテナンス作業

```bash
# サービスの更新
./scripts/deploy-production.sh update

# 設定変更の適用
kubectl apply -f deploy/production/

# ヘルスチェック
./scripts/production-status.sh all
```

## 本番運用のベストプラクティス

### 1. 監視体制
- 継続的な監視を実施 (`./scripts/monitor-production.sh continuous`)
- アラート設定を確認
- ログローテーションを設定

### 2. セキュリティ
- 定期的なセキュリティスキャン実行
- Secretの定期ローテーション
- ネットワークポリシーの確認

### 3. バックアップ
- 日次バックアップの実行
- バックアップからの復旧テスト
- 災害復旧計画の策定

### 4. アップデート
- 定期的な依存関係の更新
- セキュリティパッチの適用
- Kubernetesクラスターの更新

## 緊急時対応

### 障害発生時の対応手順

1. **障害検知**
```bash
./scripts/production-status.sh check
./scripts/monitor-production.sh
```

2. **影響範囲確認**
```bash
./scripts/production-status.sh all
kubectl get events -n production --sort-by='.lastTimestamp'
```

3. **応急対応**
```bash
# Pod再起動
kubectl rollout restart deployment/[service-name] -n production

# スケール調整
kubectl scale deployment/[service-name] --replicas=5 -n production
```

4. **ロールバック（必要時）**
```bash
./scripts/deploy-production.sh rollback
```

5. **復旧確認**
```bash
./scripts/production-status.sh all
./scripts/monitor-production.sh
```

## よくある質問

**Q: デプロイに時間がかかりすぎる場合は？**
A: `./scripts/deploy-production.sh check` で前提条件を確認し、ネットワーク接続やリソース使用状況をチェックしてください。

**Q: フロントエンドが表示されない場合は？**
A: バックエンドAPIの接続を確認し、ネットワークポリシーやCORS設定を確認してください。

**Q: Kafkaメッセージが処理されない場合は？**
A: `./scripts/production-status.sh kafka` でKafka状態を確認し、トピック設定とコンシューマーグループを確認してください。

## 連絡先とサポート

障害時やサポートが必要な場合は、以下の情報を準備してご連絡ください：

1. `./scripts/production-status.sh all` の出力
2. `kubectl get events -n production --sort-by='.lastTimestamp'` の出力  
3. 関連するログファイル
4. 発生時刻と症状の詳細
