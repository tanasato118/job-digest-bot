# job-digest-bot

クラウドワークス/ランサーズ案件を収集し、条件に合う案件を毎朝Discordへ配信するツールです。

## できること

- 複数ソースの案件を共通フォーマットに正規化
- キーワード一致・初心者歓迎・最低単価でスコアリング
- 応募人数/締切/単価/理由付きでDiscordに日次サマリー送信
- GitHub Actionsで毎朝自動実行

## セットアップ

1. Node.js 20+ を用意
2. 依存インストール

```bash
npm install
```

3. `.env.example` を `.env` にコピーして値を設定

必須:

- `DISCORD_WEBHOOK_URL`

推奨:

- `MIN_BUDGET_JPY=30000`
- `KEYWORDS=python,automation,ai`
- `PREFER_BEGINNER_FRIENDLY=true`
- `TOP_N=10`

ソース取得（公式/正規手段）:

- `CROWDWORKS_API_URL`
- `CROWDWORKS_API_TOKEN`
- `LANCERS_API_URL`
- `LANCERS_API_TOKEN`

## 実行コマンド

```bash
npm run fetch
npm run digest
npm run notify
```

出力:

- `jobs-output/latest-jobs.json`
- `jobs-output/latest-summary.txt`

## GitHub Actions運用

`.github/workflows/daily.yml` は毎日 `08:00 JST`（`23:00 UTC`）に実行します。

GitHub Secretsに以下を設定してください:

- `DISCORD_WEBHOOK_URL`
- `MIN_BUDGET_JPY`
- `KEYWORDS`
- `PREFER_BEGINNER_FRIENDLY`
- `TOP_N`
- `CROWDWORKS_API_URL`
- `CROWDWORKS_API_TOKEN`
- `LANCERS_API_URL`
- `LANCERS_API_TOKEN`

## 注意

- 公式API/正規提供手段を優先してください。
- 応募人数などが取得できない場合はサマリーで `N/A` 表示になります。
