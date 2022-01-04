FROM public.ecr.aws/lambda/python:3.9

# install requirements
# COPY requirements.txt ./
# RUN pip3 install -r requirements.txt -t .

# add src
ADD src/ ./

# lambda_endpoint.pyのスクリプトにある、handlerという関数をエントリポイントにする、
CMD ["__init__.handler"]
