package br.com.delivery.inventory.presentation;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@Hidden
@RestController
@ConditionalOnProperty(name = "inventory.swagger-enabled", havingValue = "true")
public class DocsController {
  @GetMapping(
      value = {"/docs", "/docs/"},
      produces = "text/html")
  public String docs(HttpServletRequest request) {
    return """
    <!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Estoque — Swagger</title>
    <link rel="stylesheet" href="@PREFIX@/swagger-ui/swagger-ui.css"></head><body><div id="swagger-ui"></div>
    <script src="@PREFIX@/swagger-ui/swagger-ui-bundle.js"></script><script>
    SwaggerUIBundle({url:'@PREFIX@/docs-json',dom_id:'#swagger-ui',persistAuthorization:true});
    </script></body></html>
    """
        .replace("@PREFIX@", request.getRequestURI().endsWith("/") ? ".." : ".");
  }
}
