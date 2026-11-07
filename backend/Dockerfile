FROM python:3.12-slim

ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH=/home/appuser/.local/bin:$PATH

WORKDIR /app

COPY requirements.txt ./
# Install one explicitly selected PyTorch build first. Pip sees this installed
# dependency while resolving requirements.txt, so it does not install another torch wheel.
RUN python -m pip install --upgrade pip \
    && python -m pip install --index-url "${TORCH_INDEX_URL}" torch \
    && python -m pip install -r requirements.txt \
    && python -m pip check

RUN useradd --create-home --uid 10001 appuser

COPY backend ./backend

USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
