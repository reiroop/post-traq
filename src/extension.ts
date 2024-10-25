import axios from "axios";
import * as vscode from "vscode";

// アクセストークンをSecretStorageから取得または保存する関数
async function getAccessToken(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  // SecretStorageからアクセストークンを取得
  let traqAccessToken = await context.secrets.get("traqAccessToken");

  // アクセストークンがない場合は入力を求め、保存
  if (!traqAccessToken) {
    traqAccessToken = await vscode.window.showInputBox({
      prompt: "traQのアクセストークンを入力してください",
      ignoreFocusOut: true, // ウィンドウがフォーカスを失っても入力ボックスを保持
      password: true, // パスワードフィールドとして扱う（入力が隠される）
    });

    if (traqAccessToken) {
      await context.secrets.store("traqAccessToken", traqAccessToken);
      vscode.window.showInformationMessage("アクセストークンを保存しました");
    } else {
      vscode.window.showErrorMessage("アクセストークンが入力されませんでした");
    }
  }

  return traqAccessToken;
}

// 拡張機能のアクティベーション
export function activate(context: vscode.ExtensionContext) {
  // コマンド登録：traQにメッセージを送信
  let disposable = vscode.commands.registerCommand(
    "post-traq.postMessageToTraq",
    async () => {
      // アクセストークンを取得
      const accessToken = await getAccessToken(context);
      if (!accessToken) {
        vscode.window.showErrorMessage("アクセストークンが登録されていません");
        return; // アクセストークンがない場合は処理を終了
      }

      // 設定から `channelId` を取得
      const postChannelId = vscode.workspace
        .getConfiguration("postTraq")
        .get<string>("postChannelId");

      if (!postChannelId) {
        vscode.window.showErrorMessage(
          "投稿先のチャンネルIDが設定されていません"
        );
        return;
      }

      // チャネルIDとメッセージを指定
      const channelApiUrlToPost = `https://q.trap.jp/api/v3/channels/${postChannelId}`;

      // リクエストヘッダーの設定
      const config = {
        headers: {
          Authorization: `Bearer ${accessToken}`, // アクセストークンをヘッダーに含める
          "Content-Type": "application/json",
        },
      };

      // POSTリクエストを送信
      try {
        const channelDetailResponseToPost = await axios.get(
          channelApiUrlToPost,
          config
        );

        // 成功した場合の処理
        console.log(
          "channel detail to post:",
          channelDetailResponseToPost.data
        );
        if (channelDetailResponseToPost.data.force) {
          vscode.window.showErrorMessage(
            "強制通知チャンネルが投稿先に設定されているため、投稿できません"
          );
          return;
        }
      } catch (error) {
        // エラー処理
        vscode.window.showErrorMessage(
          "チャンネル情報の取得に失敗しました: " + error
        );
        console.error("Error:", error);
        return;
      }

      const message = await vscode.window.showInputBox({
        prompt: "traQに投稿するメッセージを入力してください",
        placeHolder: "Message...",
        ignoreFocusOut: true,
      });

      if (message === undefined) {
        return;
      }

      if (!message) {
        vscode.window.showErrorMessage("メッセージが入力されませんでした");
        return;
      }

      // POSTリクエストを送信
      try {
        const response = await axios.post(
          channelApiUrlToPost + "/messages",
          {
            content: message,
          },
          config
        );

        // 成功した場合の処理
        console.log("Response:", response.data);
      } catch (error) {
        // エラー処理
        vscode.window.showErrorMessage(
          "traQへのメッセージの投稿に失敗しました: " + error
        );
        console.error("Error:", error);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// 拡張機能の非アクティベート
export function deactivate() {}
