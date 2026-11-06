import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { onlyHereIds } from './comparison'

const methods = [{ id:'tfidf', display_name:'TF-IDF', model_name:null, ready:true }, { id:'sbert-mpnet', display_name:'Sentence-BERT MPNet', model_name:'mpnet', ready:true }]
const response = (method:string, id:string) => ({ query:'BERT', method, k:5, took_ms:4, results:[{rank:1,score:.5,id,title:`${method} paper`,snippet:'A snippet',categories:['cs.CL'],year:2020}] })
function json(body: unknown, status = 200) { return Promise.resolve(new Response(JSON.stringify(body), { status, headers:{'Content-Type':'application/json'} })) }
describe('only-here comparison', () => { it('identifies IDs absent from the other column', () => expect([...onlyHereIds(response('tfidf','a'), response('sbert-mpnet','b'))]).toEqual(['a'])) })
describe('app', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/?q=BERT'); vi.stubGlobal('fetch', vi.fn((input: string) => { if (input.endsWith('/health')) return json({status:'ok',document_count:30000,methods,embedding_device:'cpu',api_version:'1'}); if (input.endsWith('/methods')) return json(methods); if (input.includes('method=tfidf')) return json(response('tfidf','a')); const body = JSON.parse((vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).body as string); return body.method === 'tfidf' ? json(response('tfidf','a')) : json(response('sbert-mpnet','b')) })) })
  it('renders both compare columns and only-here badges', async () => { render(<App />); expect(await screen.findByText('TF-IDF')).toBeInTheDocument(); await waitFor(() => expect(screen.getByText('tfidf paper')).toBeInTheDocument()); expect(screen.getAllByText('Only here')).toHaveLength(2) })
  it('keeps a successful column if the other fails', async () => { vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => { if (input.endsWith('/health')) return json({status:'ok',document_count:1,methods,embedding_device:'cpu',api_version:'1'}); if (input.endsWith('/methods')) return json(methods); const body = JSON.parse(init?.body as string); return body.method === 'tfidf' ? json(response('tfidf','a')) : json({error:{message:'Index unavailable'}},503) })); render(<App />); expect(await screen.findByText('tfidf paper')).toBeInTheDocument(); expect(screen.getByText('Index unavailable')).toBeInTheDocument() })
  it('shows the offline screen when API is unreachable', async () => { vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline')))); render(<App />); expect(await screen.findByText('Semantic Search is offline')).toBeInTheDocument() })
})
