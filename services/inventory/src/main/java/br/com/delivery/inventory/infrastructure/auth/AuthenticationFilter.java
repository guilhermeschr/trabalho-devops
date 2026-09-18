package br.com.delivery.inventory.infrastructure.auth;

import br.com.delivery.inventory.presentation.dto.ErrorResponseDto;
import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

@Component
public class AuthenticationFilter extends OncePerRequestFilter {
  private final JWTVerifier verifier;
  private final byte[] internalToken;
  private final ObjectMapper json;

  public AuthenticationFilter(
      @Value("${inventory.jwt-secret}") String secret,
      @Value("${inventory.internal-token}") String internalToken,
      ObjectMapper json) {
    if (secret.isBlank() || internalToken.isBlank() || secret.equals(internalToken))
      throw new IllegalArgumentException(
          "Segredos JWT e interno devem ser preenchidos e diferentes");
    this.verifier = JWT.require(Algorithm.HMAC256(secret)).build();
    this.internalToken = internalToken.getBytes(StandardCharsets.UTF_8);
    this.json = json;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
    if (path.startsWith("/internal/")) {
      String received = request.getHeader("X-Internal-Token");
      if (received == null
          || !MessageDigest.isEqual(internalToken, received.getBytes(StandardCharsets.UTF_8))) {
        reject(403, "FORBIDDEN", "Token interno inválido", request, response);
        return;
      }
    } else if (path.equals("/api/v1/inventory") || path.startsWith("/api/v1/inventory/")) {
      String auth = request.getHeader("Authorization");
      if (auth == null || !auth.startsWith("Bearer ")) {
        reject(401, "UNAUTHORIZED", "Token JWT ausente", request, response);
        return;
      }
      try {
        verifier.verify(auth.substring(7));
      } catch (JWTVerificationException e) {
        reject(401, "UNAUTHORIZED", "Token JWT inválido", request, response);
        return;
      }
    }
    chain.doFilter(request, response);
  }

  private void reject(
      int status,
      String code,
      String message,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException {
    response.setStatus(status);
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    json.writeValue(response.getWriter(), ErrorResponseDto.of(status, code, message, request));
  }
}
