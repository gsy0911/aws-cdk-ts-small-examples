import plotly.express as px
import plotly.io as pio
import streamlit as st

# data
data = px.data.iris()

# side menu
st.sidebar.markdown("streamlit-2: docker_lambda")
template = st.sidebar.selectbox("Template", list(pio.templates.keys()))

# body
st.write(px.scatter(data, x="sepal_width", y="sepal_length", template=template))
