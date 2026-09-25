import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { TrysteroTransport } from './lib/transport/trystero-transport';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Target element #app not found');
}

const transport = new TrysteroTransport();
const app = mount(App, { target, props: { transport } });

export default app;
