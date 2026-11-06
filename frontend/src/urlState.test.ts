import { describe, expect, it } from 'vitest'
import { parseUrlState, writeUrlState } from './urlState'
describe('URL state', () => { it('parses safe defaults and serializes a shareable state', () => { expect(parseUrlState('?q=bert&mode=search&model=tfidf&k=20')).toEqual({query:'bert',mode:'search',model:'tfidf',k:20}); writeUrlState({query:'BERT',mode:'compare',model:'sbert-mpnet',k:5}); expect(location.search).toContain('q=BERT') }) })
