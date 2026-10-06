import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const loginSource = await readFile(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8')
const registerSource = await readFile(new URL('../src/pages/Register.jsx', import.meta.url), 'utf8')
const authSource = await readFile(new URL('../src/auth.js', import.meta.url), 'utf8')
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('team final keeps the React/Supabase login and registration flow', () => {
  assert.match(loginSource, /signInWithPassword|login|Đăng nhập/i)
  assert.match(registerSource, /signUp|register|Đăng ký/i)
  assert.match(authSource, /supabase/i)
  assert.match(appSource, /path="\/login"/)
  assert.match(appSource, /path="\/register"/)
})

test('team final remains a React web project rather than mixing Flutter runtime code', () => {
  assert.doesNotMatch(appSource, /package:flutter|MaterialApp|runApp\(/)
  assert.doesNotMatch(loginSource, /package:flutter|Scaffold\(/)
  assert.doesNotMatch(registerSource, /package:flutter|Scaffold\(/)
})
