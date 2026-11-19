import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { register } from './tap-the-sign';

const app = new Hono();
register(app);

createServer(getRequestListener(app.fetch.bind(app))).listen(getServerPort());
