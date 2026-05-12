

from langgraph.graph import StateGraph, START,END, add_messages

from typing import TypedDict, Annotated

from langchain_core.messages import BaseMessage,HumanMessage
import operator

from langgraph.checkpoint.memory import MemorySaver


from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen2.5-coder:7b", base_url="http://localhost:11434")


class ChatState(TypedDict):

    messages: Annotated[list[BaseMessage], add_messages]
    

def chat_node(state: ChatState):

    response = llm.invoke(state["messages"])

    return {"messages": [response]}
  

thread_id = 1
chatbot = StateGraph(ChatState)
chatbot.add_node("chat_node", chat_node)
chatbot.add_edge(START, "chat_node")
chatbot.add_edge("chat_node", END)

checkpointers = MemorySaver()

chatbot = chatbot.compile(checkpointer=checkpointers)

# config = {"configurable": {"thread_id": thread_id}}


# result = graph.invoke({"messages": [HumanMessage(content="Tell me a joke")]},config=config)

# print(result["messages"][-1].content)