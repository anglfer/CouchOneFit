// Fixture con error de sintaxis intencional: el archivo no puede cargarse.
import { test } from 'node:test';

test('never loads', () => {
  const broken = ;
});
