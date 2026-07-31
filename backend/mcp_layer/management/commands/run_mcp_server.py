from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run the Rental-IQ MCP server over stdio (for Cursor / Claude Desktop)."

    def handle(self, *args, **options):
        # Django is already set up by manage.py before this runs.
        from mcp_layer.server import run_stdio

        self.stderr.write(self.style.NOTICE("Starting Rental-IQ MCP server (stdio)…"))
        run_stdio()
