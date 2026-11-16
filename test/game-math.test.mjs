import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom, segmentCircleHit } from '../src/game/math.ts';

describe('colisão da lâmina', () => {
  it('reconhece um corte atravessando uma fruta', () => {
    assert.equal(segmentCircleHit({ x: 0, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 50 }, 20), true);
  });
  it('não corta frutas fora da trajetória', () => {
    assert.equal(segmentCircleHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }, 20), false);
  });
  it('respeita as extremidades de um movimento curto', () => {
    assert.equal(segmentCircleHit({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 80, y: 80 }, 5), false);
  });
  it('aceita trajetórias com comprimento zero apenas se o ponto estiver dentro', () => {
    assert.equal(segmentCircleHit({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 15, y: 10 }, 6), true);
  });
});

describe('desafio diário', () => {
  it('repete a sequência de números para a mesma semente', () => {
    const first = seededRandom(12345);
    const second = seededRandom(12345);
    assert.deepEqual(Array.from({ length: 12 }, first), Array.from({ length: 12 }, second));
  });
  it('gera valores válidos para posicionar frutas', () => {
    const random = seededRandom(54321);
    for (let i = 0; i < 100; i++) {
      const value = random();
      assert.ok(value >= 0 && value < 1);
    }
  });
});
