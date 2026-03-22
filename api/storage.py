"""
OCI Object Storage client (S3-compatible).
"""
import boto3
from botocore.config import Config as BotoConfig

from api.config import get_settings

_s3_client = None


def _add_content_length(request, **kwargs):
    """OCI Object Storage는 Content-Length를 엄격하게 요구하므로 botocore가 생략할 때 강제로 끼워넣습니다."""
    if 'Content-Length' not in request.headers:
        if hasattr(request.body, 'len'):
            request.headers['Content-Length'] = str(request.body.len)
        elif hasattr(request.body, '__len__'):
            request.headers['Content-Length'] = str(len(request.body))
        elif hasattr(request.body, 'read'):
            # 파일 스트림 길이 측정
            pos = request.body.tell()
            request.body.seek(0, 2)
            length = request.body.tell()
            request.body.seek(pos)
            request.headers['Content-Length'] = str(length)

def _get_s3_client():
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    settings = get_settings()
    endpoint_url = (
        f"https://{settings.oci_namespace}.compat.objectstorage"
        f".{settings.oci_region}.oraclecloud.com"
    )
    _s3_client = boto3.client(
        "s3",
        region_name=settings.oci_region,
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.oci_access_key,
        aws_secret_access_key=settings.oci_secret_key,
        config=BotoConfig(
            signature_version="s3v4", # OCI 권장 서명 설정
            s3={"addressing_style": "path"}
        ),
    )
    
    # botocore 요청이 만들어질 때마다 강제로 헤더를 체크
    _s3_client.meta.events.register('request-created.s3', _add_content_length)
    return _s3_client


import io

def upload_file_to_oci(
    file_data: bytes,
    object_key: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload bytes to OCI Object Storage and return the object key."""
    client = _get_s3_client()
    settings = get_settings()

    # 대용량 파일(50MB 이상) 전송 시 MissingContentLength 에러 회피를 위해
    # io.BytesIO로 래핑한 뒤 multipart 업로드가 자동 적용되는 upload_fileobj 사용
    file_obj = io.BytesIO(file_data)
    client.upload_fileobj(
        file_obj,
        settings.oci_bucket_name,
        object_key,
        ExtraArgs={"ContentType": content_type}
    )
    return object_key
