import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { TrysteroTransport } from './lib/transport/trystero-transport';
import { registerServiceWorker } from './lib/pwa/register-sw';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Target element #app not found');
}

void registerServiceWorker();

const transport = new TrysteroTransport();
target.innerHTML = '';
const app = mount(App, { target, props: { transport } });

export default app;
