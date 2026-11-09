import { prepareDatabase } from '../src/server/db/setup';

const file = process.env.DATABASE_PATH || './data/nutripet.db';
const { handle, seeds } = prepareDatabase(file);
console.log(`Base de datos lista: ${file}`);
console.log(`Seeds ejecutados: ${seeds.length ? seeds.join(', ') : '(ninguno)'}`);
handle.sqlite.close();
