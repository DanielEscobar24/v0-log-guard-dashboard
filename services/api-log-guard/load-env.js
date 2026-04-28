/**
 * Debe importarse antes que el resto del servidor para que MONGODB_URL / RABBITMQ_URL
 * vengan del .env de la raíz del monorepo.
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
