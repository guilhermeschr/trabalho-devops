package br.com.delivery.inventory;

import br.com.delivery.inventory.infrastructure.auth.MetricsFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MetricsFilterTest {

  private MockHttpServletResponse request(
      String path, String configuredToken, String authorization)
      throws Exception {

    var request = new MockHttpServletRequest("GET", path);
    var response = new MockHttpServletResponse();

    if (authorization != null) {
      request.addHeader("Authorization", authorization);
    }

    new MetricsFilter(configuredToken)
        .doFilter(
            request,
            response,
            (req, res) -> res.getWriter().write("allowed"));

    return response;
  }

  @Test
  void rejectsMissingOrInvalidToken() throws Exception {
    assertEquals(
        401,
        request("/actuator/prometheus", "test-token", null).getStatus());

    assertEquals(
        401,
        request("/actuator/prometheus", "test-token", "Bearer wrong")
            .getStatus());
  }

  @Test
  void rejectsWhenTokenIsNotConfigured() throws Exception {
    assertEquals(
        401,
        request("/actuator/prometheus", "", "Bearer ").getStatus());
  }

  @Test
  void acceptsCorrectToken() throws Exception {
    assertEquals(
        "allowed",
        request("/actuator/prometheus", "test-token", "Bearer test-token")
            .getContentAsString());
  }

  @Test
  void protectsPathWithSemicolon() throws Exception {
    assertEquals(
        401,
        request("/actuator/prometheus;tracking=test", "test-token", null)
            .getStatus());
  }

  @Test
  void protectsNestedAndEncodedPaths() throws Exception {
    for (String path : new String[] {
        "/actuator/prometheus/", "/actuator/prometheus/nested",
        "/actuator/%70rometheus", "/actuator;tracking=test/prometheus"}) {
      assertEquals(401, request(path, "test-token", null).getStatus(), path);
    }
    assertEquals(401, request("/actuator/prometheus", "  ", "Bearer   ").getStatus());
    assertEquals(401, request("/actuator/prometheus", "test-token", "Basic test-token").getStatus());
  }

  @Test
  void leavesHealthAccessible() throws Exception {
    assertEquals(
        "allowed",
        request("/actuator/health/readiness", "test-token", null)
            .getContentAsString());
  }
}
