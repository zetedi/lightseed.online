import Document, { Html, Head, NextScript, Main } from 'next/document';

export default class MyDocument extends Document {
  static getInitialProps({ renderPage }) {
    const page = renderPage((App) => (props) => <App {...props} />);
    return { ...page };
  }

  render() {
    return (
      <Html lang="en-CA">
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
