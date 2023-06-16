import { buildUrl } from "@/utils/buildUrl";
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        <script src="https://unpkg.com/core-js-bundle@3.6.1/minified.js"></script>
        <script src={`${buildUrl("/Core/live2dcubismcore.js")}`}></script>
      </Head>
      <body style={{ backgroundImage: `url(${buildUrl("/bg-c.png")})` }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
