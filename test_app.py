from types import SimpleNamespace

from app import FALLBACK_ANSWER, create_app


def test_homepage_and_allowlisted_assets() -> None:
    app = create_app({"TESTING": True, "ANTHROPIC_API_KEY": ""})
    client = app.test_client()

    assert client.get("/").status_code == 200
    assert client.get("/static/styles.css").status_code == 200
    assert client.get("/static/chat.js").status_code == 200
    assert client.get("/static/app.py").status_code == 404
    assert client.get("/static/.env").status_code == 404


def test_chat_uses_retrieved_business_context() -> None:
    captured: dict[str, object] = {}

    def create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text="Contact support with your order number.")]
        )

    client = SimpleNamespace(messages=SimpleNamespace(create=create))
    app = create_app(
        {
            "TESTING": True,
            "ANTHROPIC_API_KEY": "test-key",
            "ANTHROPIC_CLIENT": client,
        }
    )

    response = app.test_client().post(
        "/api/chat", json={"question": "How can I get an order update?"}
    )

    assert response.status_code == 200
    assert response.json["answer"] == "Contact support with your order number."
    assert response.json["sources"] == ["sample-faq.md"]
    assert response.json["request_id"]
    assert "request order updates" in captured["messages"][0]["content"]
    assert "temperature" not in captured


def test_chat_reports_missing_key_and_invalid_questions() -> None:
    app = create_app({"TESTING": True, "ANTHROPIC_API_KEY": ""})
    client = app.test_client()

    missing_key = client.post(
        "/api/chat", json={"question": "How can I get an order update?"}
    )
    invalid_question = client.post("/api/chat", json={"question": "  "})
    no_match = client.post("/api/chat", json={"question": "How do I tune a piano?"})

    assert missing_key.status_code == 503
    assert "not configured" in missing_key.json["error"]
    assert invalid_question.status_code == 400
    assert no_match.status_code == 200
    assert no_match.json["answer"] == FALLBACK_ANSWER
