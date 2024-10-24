import axios from "axios";
import * as vscode from "vscode";

const CHANNEL_ID_GPS_TIMES_REI_BOT = "c5e1f23f-779e-4b78-9bab-406862f294f2";

// アクセストークンをSecretStorageから取得または保存する関数
async function getAccessToken(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  // SecretStorageからアクセストークンを取得
  let accessToken = await context.secrets.get("traqAccessToken");

  // アクセストークンがない場合は入力を求め、保存
  if (!accessToken) {
    accessToken = await vscode.window.showInputBox({
      prompt: "Enter your traQ access token",
      ignoreFocusOut: true, // ウィンドウがフォーカスを失っても入力ボックスを保持
      password: true, // パスワードフィールドとして扱う（入力が隠される）
    });

    if (accessToken) {
      await context.secrets.store("traqAccessToken", accessToken);
      vscode.window.showInformationMessage("Access token saved securely.");
    } else {
      vscode.window.showErrorMessage("Access token is required.");
    }
  }

  return accessToken;
}

// 拡張機能のアクティベーション
export function activate(context: vscode.ExtensionContext) {
  // コマンド登録：traQにメッセージを送信
  let disposable = vscode.commands.registerCommand(
    "post-traq.sendMessageToTraq",
    async () => {
      // アクセストークンを取得
      const accessToken = await getAccessToken(context);
      if (!accessToken) {
        return; // アクセストークンがない場合は処理を終了
      }

      // チャネルIDとメッセージを指定
      const apiUrl = `https://q.trap.jp/api/v3/channels/${CHANNEL_ID_GPS_TIMES_REI_BOT}/messages`;

      const message = await vscode.window.showInputBox({
        prompt: "Enter the message to send to traQ",
        placeHolder: "Message...",
        ignoreFocusOut: true,
      });

      if (!message) {
        vscode.window.showErrorMessage("Message is required.");
        return;
      }

      // リクエストヘッダーの設定
      const config = {
        headers: {
          Authorization: `Bearer ${accessToken}`, // アクセストークンをヘッダーに含める
          "Content-Type": "application/json",
        },
      };

      // POSTリクエストを送信
      try {
        const response = await axios.post(
          apiUrl,
          {
            content: message,
          },
          config
        );

        // 成功した場合の処理
        vscode.window.showInformationMessage("Message sent to traQ!");
        console.log("Response:", response.data);
      } catch (error) {
        // エラー処理
        vscode.window.showErrorMessage("Failed to send message to traQ.");
        console.error("Error:", error);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// 拡張機能の非アクティベート
export function deactivate() {}
