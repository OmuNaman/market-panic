# Teaching Rules — Market Panic

## The Session Flow
1. Students open `/join` and create agents (5 min)
2. Instructor starts simulation, shares dashboard on Zoom (15-20 min)
3. Instructor opens VS Code, walks through the code (60-90 min)
4. Connection: "This function is why your agent did X in round 12"

## Code Must Be Walkthrough-Ready
The instructor will open `agent_brain.py` in VS Code and scroll through it live on Zoom. This means:
- Every major section has a banner comment linking to a course session
- Functions are in the order they execute (retrieve → recall → analyze → decide → store → compress)
- No clever abstractions — explicit is better than elegant
- Prompt templates are inline (not hidden in separate files) so the instructor can show them
- Variable names are self-documenting: `relevant_knowledge`, `relevant_memories`, `analysis_prompt`

## Session Mapping (Always Visible in Code Comments)
```
Step 1: RAG retrieval        → Session 3 (Write, Select, Compress, Isolate)
Step 2: Memory recall        → Session 6 (Memory Architectures)
Step 3: Market analysis      → Session 2 (Context Engineering / Prompts)
Step 4: Action decision      → Session 4 (Tools & Function Calling)
Step 5: Memory storage       → Session 6 (Memory Architectures)
Step 6: Memory compression   → Session 5 (Compress & Isolate)
```

## The "Aha" Moments to Engineer
The instructor should be able to say:
- "See how Alice's agent remembered that the last MEDI rumor was false? That's the memory system from Session 6."
- "Look at the prompt — your personality text goes right here in the system prompt. That's why aggressive agents traded differently than cautious ones."
- "This agent had 80 memories by round 25. Watch what compression did — it summarized rounds 1-15 into 3 sentences. Session 5."
- "The RAG query pulled this historical pattern about pharma scandals — that's why 4 agents sold MEDI before the news even broke."

## AgentInspector Is a Teaching Tool
The slide-out panel on the dashboard isn't just cool UI — it's how the instructor shows the concepts working live:
- Memory tab: "Look, Alice has 12 memories. This one has importance 9 — it was the big crash."
- Decisions tab: "See the reasoning? The LLM used the knowledge base AND memories to decide."
- Portfolio tab: "Cautious agents have more cash, aggressive agents are all-in on their sectors."

The inspector data must include the raw personality/strategy text from the form, so students see their own words influencing the agent.
