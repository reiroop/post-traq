import axios from "axios";
import * as vscode from "vscode";

class TraqTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }
}

class TraqTreeDataProvider implements vscode.TreeDataProvider<TraqTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TraqTreeItem | undefined | void
  > = new vscode.EventEmitter<TraqTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TraqTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  getTreeItem(element: TraqTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TraqTreeItem): Thenable<TraqTreeItem[]> {
    // サイドバーに表示する項目を定義
    return Promise.resolve([
      new TraqTreeItem(
        "Send Message to traQ",
        vscode.TreeItemCollapsibleState.None,
        {
          command: "post-traq.postMessageToTraq",
          title: "Post Message",
          arguments: [], // コマンドに渡す引数
        }
      ),
    ]);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

// アクセストークンをSecretStorageから取得または保存する関数
async function getTraqAccessToken(
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
  const treeDataProvider = new TraqTreeDataProvider();
  vscode.window.registerTreeDataProvider("postTraqView", treeDataProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("post-traq.refreshView", () =>
      treeDataProvider.refresh()
    )
  );

  // コマンド登録：traQにメッセージを送信
  context.subscriptions.push(
    vscode.commands.registerCommand("post-traq.postMessageToTraq", async () => {
      // アクセストークンを取得
      const accessToken = await getTraqAccessToken(context);
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
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("post-traq.deleteTraqMessage", async () => {
      // アクセストークンを取得
      const accessToken = await getTraqAccessToken(context);
      if (!accessToken) {
        vscode.window.showErrorMessage("アクセストークンが登録されていません");
        return; // アクセストークンがない場合は処理を終了
      }

      const messageId = await vscode.window.showInputBox({
        prompt: "削除するメッセージのIDを入力してください",
        placeHolder: "Message ID...",
        ignoreFocusOut: true,
      });

      if (messageId === undefined) {
        return;
      }

      if (!messageId) {
        vscode.window.showErrorMessage("メッセージIDが入力されませんでした");
        return;
      }

      // チャネルIDとメッセージを指定
      const channelApiUrlToPost = `https://q.trap.jp/api/v3/messages/${messageId}`;

      // リクエストヘッダーの設定
      const config = {
        headers: {
          Authorization: `Bearer ${accessToken}`, // アクセストークンをヘッダーに含める
          "Content-Type": "application/json",
        },
      };

      // POSTリクエストを送信
      try {
        const response = await axios.delete(channelApiUrlToPost, config);

        // 成功した場合の処理
        vscode.window.showInformationMessage("メッセージを削除しました");
        console.log("Response:", response.data);
      } catch (error) {
        // エラー処理
        vscode.window.showErrorMessage(
          "traQへのメッセージの削除に失敗しました: " + error
        );
        console.error("Error:", error);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("post-traq.openSidebar", () => {
      const panel = vscode.window.createWebviewPanel(
        "postTraqSidebar", // Webviewの識別子
        "Post to traQ", // タイトル
        vscode.ViewColumn.One, // どのカラムに表示するか
        {
          enableScripts: true, // WebviewでJavaScriptを有効化
        }
      );

      // HTMLをWebviewにセット
      panel.webview.html = getWebviewContent();

      // Webviewからのメッセージを処理
      panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case "postMessage":
              vscode.window.showInformationMessage(`Message: ${message.text}`);
              return;
          }
        },
        undefined,
        context.subscriptions
      );
    })
  );
}

function getWebviewContent() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Post to traQ</title>
    </head>
    <body>
      <h1>Post a message to traQ</h1>
      <input id="messageInput" type="text" placeholder="Enter your message" />
      <button onclick="postMessage()">Send</button>

      <script>
        const vscode = acquireVsCodeApi();
        function postMessage() {
          const message = document.getElementById('messageInput').value;
          vscode.postMessage({
            command: 'postMessage',
            text: message
          });
        }
      </script>
    </body>
    </html>
  `;
}

// 拡張機能の非アクティベート
export function deactivate() {}
