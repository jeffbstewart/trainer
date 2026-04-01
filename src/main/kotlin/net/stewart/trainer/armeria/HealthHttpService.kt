package net.stewart.trainer.armeria

import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.common.MediaType
import com.linecorp.armeria.server.annotation.Get

class HealthHttpService {
    @Get("/health")
    fun health(): HttpResponse =
        HttpResponse.of(HttpStatus.OK, MediaType.JSON_UTF_8, """{"status":"ok"}""")
}
