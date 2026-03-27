# Claude Subconscious - Shared Memory

このワークスペースでは Letta API を使った AI 間共有メモリが有効です。
Cursor と Claude Code は同じメモリを共有しています。

## 会話開始時（必ず実行）

```bash
npm run memory
```

ダッシュボードで現在のメモリ状態と全コマンドが表示されます。

## 作業フロー

1. `npm run memory` でメモリ状態を確認
2. `.ai-handoff.md` を読んで Cursor の作業履歴を確認
3. 作業を進める
4. 重要な作業を終えたら `.ai-handoff.md` に記録する
5. ユーザーについて学んだことは `npm run memory:set` で保存する

## コマンド一覧

```bash
npm run memory                              # ダッシュボード表示
npm run memory:read                         # 全メモリ読み込み
npm run memory:get -- <label>               # 特定ブロック読み込み
npm run memory:set -- <label> "内容"         # ブロックに書き込み
npm run memory:search -- "キーワード"        # アーカイブ検索
npm run memory:insert -- "内容"              # アーカイブに保存
```

## ハンドオフ（Cursor との作業共有）

Cursor が何をしたか確認:
```bash
cat .ai-handoff.md
```

自分の作業を記録（Cursor に引き継ぎ）:
ファイル `.ai-handoff.md` に作業内容を追記する。

## メモリブロック

| ブロック | 用途 |
|---|---|
| `about_user` | ユーザー情報（名前・職業・スキル） |
| `custom_instructions` | 作業スタイルの好み・指示 |
| `learned_corrections` | 過去の修正・フィードバック |

## 原則

- 会話の最初に `npm run memory` を実行する
- Cursor の作業を確認してから自分の作業に入る
- 自分の作業は `.ai-handoff.md` に記録する
- ユーザーの好み・修正は即座に保存する
- 推測ではなく、実際に学んだことだけを保存する
