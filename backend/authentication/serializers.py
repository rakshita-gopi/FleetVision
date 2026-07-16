from rest_framework import serializers
from authentication.models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email", "role", "phone", "created_at"]
        read_only_fields = ["id", "created_at"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    name = serializers.CharField(source="full_name")

    class Meta:
        model = User
        fields = ["name", "email", "password", "role", "phone"]

    def validate_role(self, value):
        if value not in dict(UserRole.choices):
            raise serializers.ValidationError("Invalid role")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
