import ThemeProvider from '@/components/ThemeProvider';
import ParallaxPage from '../components/utils/layout/ThemeBackgroundPage';
import { tssContent } from '../content/tss-content';

const TheSecretSun = () => (
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <ParallaxPage content={tssContent} />
  </ThemeProvider>
);

export default TheSecretSun;