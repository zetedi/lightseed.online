import ThemeProvider from '@/components/ThemeProvider';
import ParallaxPage from '../components/utils/layout/ThemeBackgroundPage';
import { whitePaperContent } from '../content/white-paper-content';

const TheWhitePaper = () => (
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <ParallaxPage content={whitePaperContent} />
  </ThemeProvider>
);

export default TheWhitePaper;