import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/server';
import { register } from './adversarial-reviewer';

const app = new Hono();
register(app);

createServer(getRequestListener(app.fetch.bind(app))).listen(getServerPort());
