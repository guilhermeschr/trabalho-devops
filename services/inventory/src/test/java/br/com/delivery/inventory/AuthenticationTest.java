package br.com.delivery.inventory;

import static org.junit.jupiter.api.Assertions.*;

import br.com.delivery.inventory.infrastructure.auth.AuthenticationFilter;
import br.com.delivery.inventory.infrastructure.config.SwaggerEnvironment;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.mock.web.*;

class AuthenticationTest {
  static final String SECRET = "development-test-secret";

  MockHttpServletResponse request(String path, String name, String value) throws Exception {
    var request = new MockHttpServletRequest("GET", path);
    if (name != null) request.addHeader(name, value);
    var response = new MockHttpServletResponse();
    new AuthenticationFilter(SECRET, "internal-secret", new ObjectMapper())
        .doFilter(request, response, (req, res) -> res.getWriter().write("allowed"));
    return response;
  }

  @Test
  void externalAuthentication() throws Exception {
    assertEquals(401, request("/api/v1/inventory", null, null).getStatus());
    assertEquals(401, request("/api/v1/inventory/p", "Authorization", "Basic token").getStatus());
    for (String token :
        List.of(
            "bad",
            JWT.create()
                .withExpiresAt(Instant.now().minusSeconds(60))
                .sign(Algorithm.HMAC256(SECRET)),
            JWT.create().sign(Algorithm.HMAC256("wrong")),
            JWT.create()
                .withNotBefore(Instant.now().plusSeconds(60))
                .sign(Algorithm.HMAC256(SECRET))))
      assertEquals(
          401, request("/api/v1/inventory", "Authorization", "Bearer " + token).getStatus());
    String token =
        JWT.create()
            .withSubject("user")
            .withExpiresAt(Instant.now().plusSeconds(60))
            .sign(Algorithm.HMAC256(SECRET));
    assertEquals(
        "allowed",
        request("/api/v1/inventory", "Authorization", "Bearer " + token).getContentAsString());
  }

  @Test
  void pathParametersCannotBypassJwt() throws Exception {
    assertEquals(401, request("/api/v1/inventory;tracking=test", null, null).getStatus());
  }

  @Test
  void internalAndHealth() throws Exception {
    assertEquals(403, request("/internal/v1/inventory/debit", null, null).getStatus());
    assertEquals(
        403, request("/internal/v1/inventory/debit", "X-Internal-Token", "bad").getStatus());
    assertEquals(
        "allowed",
        request("/internal/v1/inventory/debit", "X-Internal-Token", "internal-secret")
            .getContentAsString());
    assertEquals("allowed", request("/health", null, null).getContentAsString());
  }

  @Test
  void requiresDistinctNonBlankSecrets() {
    for (String[] secrets :
        List.of(
            new String[] {"", "internal"},
            new String[] {"secret", ""},
            new String[] {"same", "same"}))
      assertThrows(
          IllegalArgumentException.class,
          () -> new AuthenticationFilter(secrets[0], secrets[1], new ObjectMapper()));
  }

  @Test
  void swaggerProductionPolicy() {
    for (boolean enabled : List.of(false, true))
      for (String mode : List.of("development", "production", "PRODUCTION")) {
        var env = new StandardEnvironment();
        env.getPropertySources()
            .addFirst(
                new MapPropertySource(
                    "test", Map.of("SWAGGER_ENABLED", String.valueOf(enabled), "NODE_ENV", mode)));
        new SwaggerEnvironment().postProcessEnvironment(env, null);
        assertEquals(
            enabled && mode.equals("development"),
            env.getProperty("springdoc.api-docs.enabled", Boolean.class));
      }
    var env = new StandardEnvironment();
    env.setActiveProfiles("prod");
    env.getPropertySources()
        .addFirst(new MapPropertySource("test", Map.of("SWAGGER_ENABLED", "true")));
    new SwaggerEnvironment().postProcessEnvironment(env, null);
    assertFalse(env.getProperty("springdoc.swagger-ui.enabled", Boolean.class));
  }
}
