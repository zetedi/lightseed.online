import PropTypes from 'prop-types';
import { ThemeProvider } from '@material-ui/core';
import Header from './Header';
import theme from '../lib/theme';

// html {
//   --red: #ff0000;
//   --black: #393939;
//   --grey: #3a3a3a;
//   --gray: var(--grey);
//   --lightGrey: #e1e1e1;
//   --lightGray: var(---lightGrey);
//   --offWhite: #ededed;
//   --maxWidth: 1000px;
//   --bs: 0 12px 24px 0 rgba(0,0,0,0.09);
//   box-sizing: border-box;
//   font-size: 62.5%;
// }

// *, *:before, *:after {
//   box-sizing: inherit;
// }

// body {
//   font-family: 'radnika_next', ---apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
//   padding: 0;
//   margin: 0;
//   font-size: 1.5rem;
//   line-height:2;
// }

export default function Page({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <div />
      <Header />
      <div style={{ margin: 0 }}>{children}</div>
    </ThemeProvider>
  );
}

Page.propTypes = {
  children: PropTypes.any,
};
