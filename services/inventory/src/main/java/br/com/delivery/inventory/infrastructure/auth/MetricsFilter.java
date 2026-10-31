package br.com.delivery.inventory.infrastructure.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

@Component
public class MetricsFilter extends OncePerRequestFilter {

  private final String token;

  public MetricsFilter(@Value("${inventory.metrics-token:}") String token) {
    this.token = token;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain chain)
      throws ServletException, IOException {

    String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);

    if (path.equals("/actuator/prometheus")
        || path.startsWith("/actuator/prometheus/")) {

      String authorization = request.getHeader("Authorization");

      boolean authorized =
          !token.isBlank()
              && authorization != null
              && MessageDigest.isEqual(
                  ("Bearer " + token).getBytes(StandardCharsets.UTF_8),
                  authorization.getBytes(StandardCharsets.UTF_8));

      if (!authorized) {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        return;
      }
    }

    chain.doFilter(request, response);
  }
}
