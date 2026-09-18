package br.com.delivery.inventory.presentation.dto;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.UUID;

public record ErrorResponseDto(
    int status, String code, Object message, String timestamp, String path, String traceId) {
  public static ErrorResponseDto of(
      int status, String code, Object message, HttpServletRequest request) {
    String trace = request.getHeader("X-Request-Id");
    if (trace == null || trace.isBlank()) trace = request.getHeader("X-Trace-Id");
    if (trace == null || trace.isBlank()) trace = UUID.randomUUID().toString();
    return new ErrorResponseDto(
        status, code, message, Instant.now().toString(), request.getRequestURI(), trace);
  }
}
