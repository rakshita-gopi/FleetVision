import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class FleetTelemetryConsumer(AsyncWebsocketConsumer):
    group_name = "fleet_live"

    async def connect(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({"type": "connection.established"}))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def telemetry_update(self, event):
        payload = event.get("payload") or event
        await self.send(text_data=json.dumps(payload))
