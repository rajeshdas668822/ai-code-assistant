import warnings
import uuid
warnings.filterwarnings("ignore")

import streamlit as st 
from chatbot_backend import chatbot
from langchain_core.messages import HumanMessage

################ Util ############################

def get_thread_id():
  return uuid.uuid4().hex[:12]

def reset_chat():  
  thread_id = get_thread_id()
  st.session_state['thread_id'] = thread_id
  add_thread()
  st.session_state['message_history'] = []

def add_thread():
  if st.session_state['thread_id']:
    st.session_state['chat_threads'].append(st.session_state['thread_id'])
    
def load_conversion(thread_id):
  response = chatbot.get_state(config= {"configurable": {"thread_id": thread_id}})
  print(response)
  return response.values["messages"]
    
  
  

  


################ Session Set up ###############

if "message_history" not in st.session_state:
  st.session_state['message_history'] = []  
  
if "thread_id" not in st.session_state:
  st.session_state['thread_id'] = get_thread_id()

if "chat_threads" not in st.session_state:
  st.session_state['chat_threads'] = []
  


  
############### Side Bar UI #################

st.sidebar.title("LangGraph ChatBot")

if st.sidebar.button("New Chat"):
  if st.session_state['thread_id']:   
   reset_chat()
  
st.sidebar.header("My Conversion")

for thread_id in st.session_state['chat_threads']:
  if st.sidebar.button(thread_id):
     messages = load_conversion(thread_id) 
     temp_messages = []
     for message in messages:
        if isinstance(message, HumanMessage):
          temp_messages.append({'role':'user', 'content':message.content})
        else:
          temp_messages.append({'role':'assistant', 'content':message.content})
     st.session_state['message_history'] = temp_messages
     st.session_state['thread_id'] = thread_id




  
 ################# Main UI ######################
  
for message in st.session_state['message_history']:    
  with st.chat_message(message['role']):
    st.text(message['content'])


user_input = st.chat_input("type here")  
config = {"configurable": {"thread_id": st.session_state['thread_id']}}

if user_input:  
  st.session_state['message_history'].append({'role':'user','content':user_input})
  with st.chat_message("user"):
    st.text(user_input)      
    
 
  # response = chatbot.invoke({"messages": [HumanMessage(content=user_input)]}, config=config)
  # ai_message = response['messages'][-1].content
  
  with st.chat_message("assistant"):
   ai_message = st.write_stream(
      message_chunk.content for message_chunk, metadata in
      chatbot.stream({"messages": [HumanMessage(content=user_input)]},
                          config=config,stream_mode='messages'))
  st.session_state['message_history'].append({'role':'assistant','content':ai_message})


  
