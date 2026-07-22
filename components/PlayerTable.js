// components/PlayerTable.js
'use client';
import { useState } from 'react';
import styles from './PlayerTable.module.css';

let _counter = 100;
const newId = () => 'p' + _counter++;

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

export default function PlayerTable({ players, setPlayers, onBlur, rounds = 6, courts = 2 }) {

  const update = (id, field, value) => {
    setPlayers(players.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const remove = (id) => {
    setPlayers(players.filter((p) => p.id !== id));
    onBlur?.();
  };

  const addPlayer = () => {
    const next = [...players, { id: newId(), name: `회원${players.length + 1}`, gender: 'M', ntrp: 2.0, target: 0 }];
    setPlayers(next);
  };

  const autoBalance = () => {
    const total = rounds * courts * 4;
    const n = players.length;
    if (n === 0 || total <= 0) return;
    const base = Math.floor(total / n);
    let rem = total - base * n;
    setPlayers(players.map((p, i) => ({ ...p, target: base + (i < rem ? 1 : 0) })));
    onBlur?.();
  };

  return (
    <div>
      <div className={`table-wrap`}>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>성별</th>
              <th>NTRP</th>
              <th>목표 게임수</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    className="input input-sm"
                    type="text"
                    value={p.name}
                    onChange={(e) => update(p.id, 'name', e.target.value)}
                    onBlur={onBlur}
                    style={{ width: 100 }}
                  />
                </td>
                <td>
                  <select
                    className="select input-sm"
                    value={p.gender}
                    onChange={(e) => { update(p.id, 'gender', e.target.value); onBlur?.(); }}
                    style={{ width: 60 }}
                  >
                    <option value="M">남</option>
                    <option value="F">여</option>
                  </select>
                </td>
                <td>
                  <select
                    className="select input-sm"
                    value={p.ntrp}
                    onChange={(e) => { update(p.id, 'ntrp', parseFloat(e.target.value)); onBlur?.(); }}
                    style={{ width: 70 }}
                  >
                    {NTRP_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v.toFixed(1)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="input input-sm"
                    type="number"
                    min="0"
                    value={p.target}
                    onChange={(e) => update(p.id, 'target', parseInt(e.target.value) || 0)}
                    onBlur={onBlur}
                    style={{ width: 65 }}
                  />
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)} type="button">
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.toolbar}>
        <button className="btn btn-secondary btn-sm" onClick={addPlayer} type="button">+ 회원 추가</button>
        <button className="btn btn-secondary btn-sm" onClick={autoBalance} type="button">목표 게임수 자동 균등배분</button>
      </div>
    </div>
  );
}
