package br.com.delivery.inventory.infrastructure.config;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration
@EnableTransactionManagement
public class DatabaseConfig {
  private DataSource source(Environment env, String mode) {
    var ds = new HikariDataSource();
    ds.setJdbcUrl(env.getRequiredProperty("inventory." + mode + ".url"));
    ds.setUsername(env.getRequiredProperty("inventory." + mode + ".username"));
    ds.setPassword(env.getRequiredProperty("inventory." + mode + ".password"));
    ds.setPoolName("inventory-" + mode);
    ds.setMaximumPoolSize(10);
    return ds;
  }

  @Bean
  @Primary
  DataSource writeDataSource(Environment env) {
    return source(env, "write");
  }

  @Bean
  DataSource readDataSource(Environment env) {
    return source(env, "read");
  }

  @Bean(initMethod = "migrate")
  Flyway writeFlyway(@Qualifier("writeDataSource") DataSource ds) {
    return migration(ds, "write");
  }

  @Bean(initMethod = "migrate")
  Flyway readFlyway(@Qualifier("readDataSource") DataSource ds) {
    return migration(ds, "read");
  }

  private Flyway migration(DataSource ds, String mode) {
    // Baseline 0 lets V1 adopt existing TypeORM tables without deleting their data.
    return Flyway.configure()
        .dataSource(ds)
        .locations("classpath:db/" + mode)
        .baselineOnMigrate(true)
        .baselineVersion("0")
        .load();
  }

  @Bean
  @DependsOn("writeFlyway")
  JdbcTemplate writeJdbc(@Qualifier("writeDataSource") DataSource ds) {
    return new JdbcTemplate(ds);
  }

  @Bean
  @DependsOn("readFlyway")
  JdbcTemplate readJdbc(@Qualifier("readDataSource") DataSource ds) {
    return new JdbcTemplate(ds);
  }

  @Bean
  PlatformTransactionManager writeTransactionManager(@Qualifier("writeDataSource") DataSource ds) {
    return new JdbcTransactionManager(ds);
  }

  @Bean
  PlatformTransactionManager readTransactionManager(@Qualifier("readDataSource") DataSource ds) {
    return new JdbcTransactionManager(ds);
  }
}
