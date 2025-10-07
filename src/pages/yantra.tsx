import ThemeProvider from '@/components/ThemeProvider';
import ParallaxPage from '../components/utils/layout/ThemeBackgroundPage';
import { yantraContent } from '../content/yantra-content';

const Yantra = () => (
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <ParallaxPage content={yantraContent} />
  </ThemeProvider>
);

export default Yantra;