import ZAI from 'z-ai-web-dev-sdk'

// Cache the ZAI SDK instance across requests so we don't re-create it on
// every API call (the SDK construction can do auth / config work).
let _zai: Promise<any> | null = null

export function getZAI(): Promise<any> {
  if (!_zai) {
    _zai = ZAI.create()
  }
  return _zai
}
