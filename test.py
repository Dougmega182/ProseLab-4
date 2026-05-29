import json
from phase6.llm.providers.galaxy import GalaxyProvider
from phase6.llm.providers.base import LLMCall

provider = GalaxyProvider()
request = LLMCall(
    model_id="claude-4.6-opus",
    system="System prompt",
    user_message="Test prompt",
    cached_blocks=[],
    schema={"type": "object"}
)
res = provider.call(request)
print("TEXT:")
print(res.text)
print("RAW RESPONSE:")
print(json.dumps(res.raw_response, indent=2))
