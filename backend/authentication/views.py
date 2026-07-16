from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

from common.response import api_response
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


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
        refresh = RefreshToken.for_user(user)
        return api_response(True, "Login successful", {
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "role": user.role,
            "user": UserSerializer(user).data,
        })


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
