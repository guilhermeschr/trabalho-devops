package br.com.delivery.inventory.presentation;

import br.com.delivery.inventory.domain.StockException;
import br.com.delivery.inventory.presentation.dto.ErrorResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(StockException.class)
  public ResponseEntity<ErrorResponseDto> stock(StockException e, HttpServletRequest request) {
    return response(e.status(), e.code(), e.getMessage(), request);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponseDto> validation(
      MethodArgumentNotValidException e, HttpServletRequest request) {
    return response(
        400,
        "VALIDATION_ERROR",
        e.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .toList(),
        request);
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    HandlerMethodValidationException.class
  })
  public ResponseEntity<ErrorResponseDto> malformed(Exception e, HttpServletRequest request) {
    return response(400, "VALIDATION_ERROR", "Requisição inválida", request);
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<ErrorResponseDto> missing(Exception e, HttpServletRequest request) {
    return response(404, "NOT_FOUND", "Rota não encontrada", request);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponseDto> unexpected(Exception e, HttpServletRequest request) {
    return response(500, "INTERNAL_SERVER_ERROR", "Erro interno do servidor", request);
  }

  private ResponseEntity<ErrorResponseDto> response(
      int status, String code, Object message, HttpServletRequest request) {
    return ResponseEntity.status(status).body(ErrorResponseDto.of(status, code, message, request));
  }
}
