from app.services.authentication import AuthenticationError, DirectoryProfile, RateLimiter


def test_rate_limiter_rejects_attempts_over_limit() -> None:
    limiter = RateLimiter()
    assert limiter.allow("127.0.0.1:alex", 2)
    assert limiter.allow("127.0.0.1:alex", 2)
    assert not limiter.allow("127.0.0.1:alex", 2)


def test_directory_profile_is_provider_neutral() -> None:
    profile = DirectoryProfile("alex", "Alex Example", "alex@example.com", ["CN=ALS50-Administrators"])
    assert profile.username == "alex"
    assert profile.groups == ["CN=ALS50-Administrators"]


def test_authentication_error_exposes_safe_contract_only() -> None:
    error = AuthenticationError("AUTH_PROVIDER_UNAVAILABLE", "RSA Authentication Manager is not configured.", 503)
    assert error.code == "AUTH_PROVIDER_UNAVAILABLE"
    assert error.status_code == 503