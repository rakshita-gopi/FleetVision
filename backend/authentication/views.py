from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from common.response import api_response
from .models import User, UserRole
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


def _token_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access_token": str(refresh.access_token),
        "refresh_token": str(refresh),
        "role": user.role,
        "user": UserSerializer(user).data,
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(False, "Registration failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return api_response(True, "Registration Successful", status_code=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(False, "Invalid credentials", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        user = authenticate(email=serializer.validated_data["email"], password=serializer.validated_data["password"])
        if not user:
            return api_response(False, "Invalid login credentials", status_code=status.HTTP_401_UNAUTHORIZED)
        return api_response(True, "Login successful", _token_payload(user))


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return api_response(False, "Google credential is required", status_code=status.HTTP_400_BAD_REQUEST)
        if not settings.GOOGLE_CLIENT_ID:
            return api_response(
                False,
                "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID on the server.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            return api_response(False, "Invalid Google credential", status_code=status.HTTP_401_UNAUTHORIZED)

        google_sub = idinfo.get("sub")
        email = idinfo.get("email")
        full_name = idinfo.get("name") or (email.split("@")[0] if email else "Google User")
        if not google_sub or not email:
            return api_response(False, "Google account is missing required profile data", status_code=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(google_id=google_sub).first()
        if not user:
            user = User.objects.filter(email__iexact=email).first()
            if user:
                if not user.google_id:
                    user.google_id = google_sub
                    user.save(update_fields=["google_id", "updated_at"])
            else:
                user = User.objects.create_user(
                    email=email,
                    password=None,
                    full_name=full_name,
                    google_id=google_sub,
                    role=UserRole.FLEET_MANAGER,
                )
                user.set_unusable_password()
                user.save(update_fields=["password"])

        if not user.is_active:
            return api_response(False, "Account is inactive", status_code=status.HTTP_403_FORBIDDEN)

        return api_response(True, "Login successful", _token_payload(user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return api_response(True, "Logged out successfully")


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return api_response(False, "Refresh token required", status_code=status.HTTP_400_BAD_REQUEST)
        try:
            refresh = RefreshToken(refresh_token)
            return api_response(True, "Token refreshed", {"access_token": str(refresh.access_token)})
        except Exception:
            return api_response(False, "Invalid refresh token", status_code=status.HTTP_401_UNAUTHORIZED)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return api_response(True, "Profile retrieved", UserSerializer(request.user).data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_response(True, "Profile updated", serializer.data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
